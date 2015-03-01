//////////////////////////////////////
// GeoAnim 0.1 - samim - 26.02.2015 //
//////////////////////////////////////

//////////////// Vars ////////////////
var clips = [];
var currentClip;
var animations = {"anims":[{"time":0,"pitch":4.2, "heading":80, "zoom":1, "k":35.660898, "D" : 139.738688}]};

var currentFrame = 0;
var currentPage = 0;
var resultsPerPage = 10;

var recording = false;
var playing = true;
var looping = true;
var tweaking = false;
var saving = false;
var continuousplay = true;

var aboutVisible = true;
var browseVisible = false;
var controlVisible = false;

var recordingInterval;
var recordingTimer = 0;
var smoothRate = 2;
var selectedSmooth = smoothRate;

var map;
var panorama;
var fenway = new google.maps.LatLng(animations.anims[0].k, animations.anims[0].D);

var mapOptions = {
  center: fenway,
  zoom: 15,
  disableDefaultUI :false,
  panControl : false,
  rotateControl:false,
  zoomControl:true,
  scaleControl:false,
  overviewMapControl:false,
  scrollwheel:true,
  streetViewControl:true,
  keyboardShortcuts:true,
  draggable:true,
  mapTypeControl:true,
  mapTypeId:google.maps.MapTypeId.MAP,
  tilt:0
};
var panoOptions = {
  position: fenway,
  pov: {
    heading: 0,
    pitch: 0
  },
  linksControl: false,
  panControl: false,
  zoomControl: false,
  rotateControl:false,
  enableCloseButton: false,
  disableDoubleClickZoom: true,
  draggable: true,
  scrollwheel: true,
  clickToGo: true,
  disableDefaultUI: true
};

var pov = {heading:0,pitch:0};
var difference = function (a, b) { return Math.abs(a - b) }
var timeouts = [];
//////////////// Play Animation ////////////////

function animationReset(){
  currentFrame = 0;
  var currentPov = panorama.getPov();
  currentPov.pitch = animations.anims[currentFrame].pitch;
  currentPov.heading = animations.anims[currentFrame].heading;
  pov = {heading:currentPov.heading,pitch:currentPov.pitch };
  currentPov.zoom = animations.anims[currentFrame].zoom;
  panorama.setPov(currentPov);
  var latlng = new google.maps.LatLng(animations.anims[currentFrame].k, animations.anims[currentFrame].D);
  panorama.setPosition(latlng);
}

function animationManager(){
  if(animations.anims === undefined){return;}
  // console.log("animationManager: anims.length: " + animations.anims.length);
 
  //clear timeouts
  for (var i = 0; i < timeouts.length; i++) {
    clearTimeout(timeouts[i]);
  }
  timeouts = [];

  function animatedPov(){
    var currentPov = panorama.getPov();
    currentPov.heading = pov.heading;
    currentPov.pitch = pov.pitch;
    panorama.setPov(currentPov);
    setTimeout(function(){
      if(!recording && playing){animatedPov();}
    },10);
  }

  animatedPov();

  var posTemp;
  var zoomTemp;
  var headingTemp;

  function move(){
    if(animations.anims[currentFrame] === undefined || !playing || recording){return;}

    // current view & buffer old view
    var currentPov = panorama.getPov();
    var targetPov = animations.anims[currentFrame];

    // next frame / looping
    if(currentFrame < animations.anims.length-2){
      currentFrame+=1;
    }
    else{
      // console.log("Anim Done");
      if(animations.anims[currentFrame] === undefined || animations.anims[currentFrame+1] === undefined){return;}
      var waitTime = animations.anims[currentFrame+1].time - animations.anims[currentFrame].time;
      var loadNextFromDB = false;
      // load next clip in clips or back to first
      if(looping){
        if(currentClip < clips.length-1){
          currentClip++;
        }else{
          if(continuousplay){
            loadNextFromDB = true;
            loadAnim("rand",animationManager);
          }
          currentClip = 0;
        }
      }
      if(!loadNextFromDB){
        timeouts.push(setTimeout(function(){
          if(playing){$("#panorama").fadeOut(500);}
          timeouts.push(setTimeout(function(){
            if(!playing){$("#panorama").fadeIn();return;}
            loadClip(currentClip);
            animationManager();
          },500));

        },waitTime));
      }

      return;
    }

    // walking
    if(animations.anims[currentFrame].k + animations.anims[currentFrame].D !== posTemp){
      var latlng = new google.maps.LatLng(animations.anims[currentFrame].k, animations.anims[currentFrame].D);
      panorama.setPosition(latlng);
      posTemp = animations.anims[currentFrame].k + animations.anims[currentFrame].D;
      var walkTime = walkTime  = animations.anims[currentFrame+1].time - animations.anims[currentFrame].time;
      timeouts.push(setTimeout(function(){ if(!recording){move();} },walkTime));
      return;
    }

    // zooming
    if(animations.anims[currentFrame].zoom !== zoomTemp){
      currentPov.zoom = animations.anims[currentFrame].zoom;
      panorama.setPov(currentPov);
      zoomTemp = animations.anims[currentFrame].zoom;
      var zoomTime  = animations.anims[currentFrame+1].time - animations.anims[currentFrame].time;
      timeouts.push(setTimeout(function(){ if(!recording){move();} },zoomTime));
      return;
    }

    // backup pos & zoom
    posTemp = animations.anims[currentFrame].k + animations.anims[currentFrame].D;
    zoomTemp = animations.anims[currentFrame].zoom;

    // heading & pitch correction for anim system
    var dif = difference(targetPov.heading,currentPov.heading);
    if(dif > 150){
      var headMod = -360;
      if (headingTemp > 0){headMod = 360;}
      targetPov.heading += headMod;
      // console.log("targetPov.heading: " + targetPov.heading + " currentPov.heading: " + currentPov.heading + " dif: " + dif);
    }
    headingTemp = targetPov.heading;

    // animate pitch & heading
    TweenLite.to(pov, smoothRate, {heading: targetPov.heading, pitch: targetPov.pitch});
    
    // next frame wait time
    var waitTime = animations.anims[currentFrame+1].time - animations.anims[currentFrame].time;
    if(waitTime > 20){
      timeouts.push(setTimeout(function(){ move(); },waitTime));
    }
    else{
      timeouts.push(setTimeout(function(){ move(); },10));
    }
  }
  move();
}

//////////////// Record Animation ////////////////

function recordAnimation(){

  // recording timer
  function recordTimer(){
    recordingTimer = 0;
    clearInterval(recordingInterval);
    recordingInterval = setInterval(function(){ 
      recordingTimer += 10;
    },10);
  }

  if(!recording){
    // change button text
    $("#recordstart").html('Stop Recording');
    $("#recordstart").addClass('recording');
    $('.rec_hide').hide();

    // stop autoloading new anims from db
    continuousplay = true;
    continuousClips();

    // reset animations
    animations.anims = [];
    recordTimer();

    // switch button status
    recording = true;
    playing = false;
  }
  else{
    // reset gui
    $("#recordstart").html('Record');
    $("#recordstart").removeClass('recording');
    $('.rec_hide').show();
    $('#clip_settings').hide();
    $('#tweakClip').removeClass('btn_active');
    tweaking = false;

    saving = true;
    saveClips();

    // clear recording timer
    clearInterval(recordingInterval);
    recording = false;

    // if recording not empty
    if(animations.anims.length > 0){
      // insert end frame
      var endFrame = {"time":recordingTimer,"pitch":panorama.getPov().pitch, "heading":panorama.getPov().heading, "zoom":panorama.getPov().zoom, "k":panorama.getPosition().k,"D":panorama.getPosition().D}
      animations.anims.push(endFrame);

      // push recorded frames to clips
      var finalData = {
        animmedia:'',
        animsmooth:selectedSmooth,
        animdata:animations.anims,
      }
      clips.push(finalData);
      
    }
    showClips();
    
    // load recorded animation
    loadClip(clips.length-1);

    // play recorded animation
    playing = false;
    playClip();
  }
}

//////////////// Buttons ////////////////

function loadClip(clipid){
  $("#panorama").fadeIn(1500);
  $(".clip").removeClass("clip_active");
  $("#clip_"+clipid).addClass("clip_active");

  if(clips === undefined){
    animationReset();
    return;
  }

  smoothRate = clips[clipid].animsmooth;
  animations.anims = clips[clipid].animdata;
  currentClip = clipid;
  animationReset();
  // console.log("loadClip: " + clipid);

  if(clips[currentClip]!== undefined){
    $('#smooth_val').html(clips[currentClip].animsmooth);
    $('#smooth').val(clips[currentClip].animsmooth * 100);
  }
}

function playClip(){
  if(playing){
    $("#playanim").html('Play');
    playing = false;
  }
  else{
    $("#playanim").html('Stop');
    playing = true;
    animationManager();
  }
}

function deleteClip(){
  if(clips.length > 1){
    clips.splice(currentClip, 1);
    currentClip = 0;
    showClips();
    loadClip(0);
  }
}

function tweakClip(){
  if(tweaking){
    tweaking = false;
    $('#tweakClip').removeClass('btn_dark_active');
    $('#clip_settings').hide();
  }
  else{
    tweaking = true;
    $('#clip_settings').show();
    $('#tweakClip').addClass('btn_dark_active');
  }
}

function saveClips(){
  if(saving){
    saving = false;
    $('#saveClip').removeClass('btn_dark_active');
    $('#save_settings').hide();
    $('#save_input').hide();
  }
  else{
    saving = true;
    $('#save_settings').show();
    $('#save_input').show();
    $('#save_message').hide();
    $('#saveClip').addClass('btn_dark_active');
  }
}

function loopClips(){
  if(looping){
    looping = false;
    $("#loopClip").html('Loop Off');
  }
  else{
    looping = true;
    $("#loopClip").html('Loop On');
  }
}

function continuousClips(){
  if(continuousplay){
    continuousplay = false;
    $("#continuousplay").removeClass('btn_dark_active');
  }
  else{
    continuousplay = true;
    $("#continuousplay").addClass('btn_dark_active');
  }
}

function showClips(){
  if(clips === undefined){return;}
  $("#clips_container").empty();
  var clipactive = "";
  for(var i=0;i < clips.length;i++){
    var clipname = i+1;
    if(i===0){clipactive = "clip_active";}else{clipactive = "";}
    $("#clips_container").append("<div onclick='loadClip("+i+")' id=clip_"+i+" class='clip "+clipactive+"' style='width:"+clips[i].animdata[clips[i].animdata.length-1].time / 1000+"'>"+clipname+"</div>")
  }
}

// tabs
function showControl(){
  if(controlVisible){
    TweenLite.to($("#controls"), 0.4, {top:"-700px",ease:Back.easeIn});
    controlVisible = false;
    $('#showControl').removeClass('btn_active');
    $('#showControl').show();
  }
  else{
    TweenLite.to($("#controls"), 0.4, {top:"-60px",ease:Back.easeOut});

    $("#clips").fadeIn();
    browseVisible = false;
    aboutVisible = false;
    controlVisible = true;
    $("#tab_browse").hide();
    $("#tab_control").show();
    $("#tab_about").hide();
    $('#showControl').addClass('btn_active');
    $('#about').removeClass('btn_active');
    $('#browse').removeClass('btn_active');

    center_map();
  }
}
function showBrowse(){
  if(browseVisible){
    TweenLite.to($("#controls"), 0.4, {top:"-700px",ease:Back.easeIn});
    browseVisible = false;
    $('#browse').removeClass('btn_active');
  }
  else{
    TweenLite.to($("#controls"), 0.4, {top:"-60px",ease:Back.easeOut});
    browseVisible = true;
    aboutVisible = false;
    controlVisible = false;
    $("#tab_browse").show();
    $("#tab_control").hide();
    $("#tab_about").hide();
    $('#browse').addClass('btn_active');
    $('#about').removeClass('btn_active');
    $('#showControl').removeClass('btn_active');

    // reset browse list & get new results
    $("#browse_scroll").empty();
    currentPage = 0;
    loadAnims(currentPage);
  }
}
function showAbout(){
  if(aboutVisible){
    TweenLite.to($("#controls"), 0.4, {top:"-700px",ease:Back.easeIn});
    aboutVisible = false;
    $('#about').removeClass('btn_active');
  }
  else{
    TweenLite.to($("#controls"), 0.4, {top:"-60px",ease:Back.easeOut});
    aboutVisible = true;
    browseVisible = false;
    controlVisible = false;
    $("#tab_browse").hide();
    $("#tab_control").hide();
    $("#tab_about").show();
    $('#browse').removeClass('btn_active');
    $('#about').addClass('btn_active');
    $('#showControl').removeClass('btn_active');
  }
}
//////////////// Save & Load Anims from Server ////////////////


function parseDate(dateInput){
  var dateSplit1 = dateInput.split(" ");
  var dateSplit2 = dateSplit1[0].split("-");
  var year = dateSplit2[0];
  var month = dateSplit2[1];
  var day = dateSplit2[2];
  var dateSplit3 = dateSplit1[1].split(":");
  var hours = dateSplit3[0];
  var minutes = dateSplit3[1];
  return day + "." + month + "." + year; //+ ", " + hours + ":" + minutes;
}

function saveAnim(){
  $('#save_message').html("Saving...");
  $('#save_message').show();
  $('#save_input').hide();

  var jsondata = JSON.stringify(clips);

  var animTotalTime = 0;
  for(var i=0;i<clips.length;i++){
    var animTime = clips[i].animdata[clips[i].animdata.length-1].time;
    animTotalTime += animTime
  }

  var animname = $("#save_animname").val();
  var animusername = $("#save_username").val();
  if(animname.length <= 0){animname = "Animation";}
  if(animusername.length <= 0){animusername = "Anonymous";}

  var data = {
    username:animusername,
    animname:animname,
    animtime:animTotalTime,
    animclips:jsondata
  }

  $.post('json_post.php', data, function(returnedData) {
    $('#save_message').html("Animation Saved!");
    setTimeout(function(){
      saving = true;
      saveClips();
    },1500);
  });
}

function loadAnim(animId,callback){
  //console.log("loadAnim: id: " +animId);
  $("#loading").fadeIn();

  $.getJSON( "json_get.php?id="+animId, function( data ) {
    var items = [];
    $.each( data, function( key, val ) {
      items.push(val);
    });

    var newClip = {};
    var foundAnim = false;
    if(items[0] !== undefined){
      newClip.clipId = items[0][0];
      newClip.clipName = items[0][1];
      newClip.clipUser = items[0][2];
      newClip.clipDate = items[0][3];
      newClip.clipTime = items[0][4];    
      newClip.clipData = jQuery.parseJSON( items[0][5] );
      foundAnim =true;

      // change url
      if (history && history.pushState){
        var url = window.location.href.split('?')[0];
        url += "?id="+newClip.clipId;
        history.pushState(null, null, url);
      }
    }

    $("#loading").fadeOut();
    $("#panorama").fadeOut(0);
    $("#panorama").fadeIn(3000);
      
    var finaldate = parseDate(newClip.clipDate);
    var time = newClip.clipTime/1000;
    var cliptime = time.toString().split('.')[0];
    $("#animation_info").html(newClip.clipName + "<br/><small>by " + newClip.clipUser + " - "+finaldate+" - "+cliptime+"s</small>");
    clips = newClip.clipData;
    if(callback !== null){callback(foundAnim);}

    loadClip(0);
    showClips();
  });
}

function loadAnims(pageNumber){
  //console.log("loadAnims: pageNumber: " + pageNumber + " currentPage: " + currentPage);
  $.getJSON( "json_get.php?amount="+resultsPerPage+"&page="+pageNumber, function( data ) {
    var items = [];
    $.each( data, function( key, val ) {
      items.push(val);
    });

    if(items.length > 0){
      for(var i=0;i<items.length;i++){
        var finaldate = parseDate(items[i][3]);
        var time = items[i][4] / 1000;
        var cliptime = time.toString().split('.')[0];
        var newItem = '<div onclick="loadAnim('+items[i][0]+',null)" class="browse_item">'
        newItem += items[i][1] ;
        newItem += '<br/><small>';      
        newItem += 'by ' + items[i][2] + ' - ' + finaldate +' - '+cliptime +'s';
        newItem += '</small></div>';
        $("#browse_scroll").append(newItem);
      }
      currentPage+=resultsPerPage;
    }
  });
}

//////////////// Share buttons ////////////////

function ShareTwitter() {
    var text = "GeoAnim let´s you animate streetview and share your movies. Check out my anim";
    var finaltext = text.replace(/\s+/g, '+');
    var url = document.URL;

    var win3 = window.open( "http://twitter.com/intent/tweet?url="+url+"&text="+finaltext+":"+"&hashtags=GeoAnim&amp", "myWindow", "height = 310, width = 500, top = 200, left = 200, toolbar=no, directories=no, status=no, menubar=no, scrollbars=no, resizable=no")
    win3.moveTo(screen.width/2-250,screen.height/2-155)
}
function ShareFacebook() {
    var text = "GeoAnim let´s you animate streetview and share your movies. Check out my anim";
    var title = "GeoAnim";
    var imgurl = "img/cover_img.jpg";
    var url = document.URL;

    var finaltext = text.replace(/\s+/g, '+');
    var facebookShareURL = "http://www.facebook.com/sharer.php?s=100&p[title]="+title+"&p[url]="+url+"&p[summary]="+finaltext+"&p[images][0]="+imgurl;

    var win3 = window.open(facebookShareURL,"myWindow", "height = 310, width = 500, top = 200, left = 200, toolbar=no, directories=no, status=no, menubar=no, scrollbars=no, resizable=no" )
    win3.moveTo(screen.width/2-250,screen.height/2-155)
}
function ShareEmail() {
    var body = "GeoAnim let´s you animate streetview and share your movies. Explore the world. Check out my animation here: " + document.URL;
    var subject = "GeoAnim - Animate streetview";
    window.open('mailto:?subject='+subject+'&body='+body+'');
}

//////////////// App Startup ////////////////

function initialize() {
  // reset GUI
  $('#clip_settings').hide();
  $('#save_settings').hide();
  $('#save_message').hide();
  $("#tab_browse").hide();
  $("#tab_control").hide();
  $("#tab_about").show();

  // GUI interaction handler
  $('#smooth').change( function() {
      var newValue = this.value / 100;
      selectedSmooth = newValue;
      if(clips[currentClip]!== undefined){clips[currentClip].animsmooth = selectedSmooth;}
      $('#smooth_val').html(selectedSmooth);
  });

  // infinite scroll
  $('#browse_scroll').bind('scroll', function() {
    if($(this).scrollTop() + $(this).innerHeight() >= this.scrollHeight) {
      loadAnims(currentPage);
    }
  })
  
  // load animations from server
  loadAnims(0);

  

  function loadcallback(foundAnim){
    if(foundAnim){
      var newpov = {
        heading: clips[0].animdata[0].heading,
        pitch: clips[0].animdata[0].pitch
      }
      panoOptions.pov = newpov;
      fenway = new google.maps.LatLng(clips[0].animdata[0].k, clips[0].animdata[0].D);
    }
    $("#controls").css("display","inline");
    $("#container").css("display","inline");
    TweenLite.to($("#controls"), 0.4, {top:"-60px",ease:Back.easeOut});
    mapSetup();
  }

  // inital browser load
  var url = window.location.href.split('?')[1];
  if(url !== undefined){
    var parameter = url.split('=')[1];
    if(parameter !== undefined){
      // console.log("url parameters: " + parameter);
      loadAnim(parameter,loadcallback);
    }
  }
  else{
    parameter = "rand";
    loadAnim(parameter,loadcallback);
  }

  function mapSetup(){
    // setup map & streetview
    map = new google.maps.Map(document.getElementById('map-canvas'), mapOptions);
    panorama = new google.maps.StreetViewPanorama(document.getElementById('panorama'), panoOptions);
    map.setStreetView(panorama);
    
    animationReset();

    setTimeout(function(){
      animationManager();
    },200);
    
    // map move listeners
    google.maps.event.addListener(panorama, 'position_changed', function() {
      if(recording){
          var newFrame = {"time":recordingTimer,"pitch":panorama.getPov().pitch, "heading":panorama.getPov().heading, "zoom":panorama.getPov().zoom, "k":panorama.getPosition().k,"D":panorama.getPosition().D}
          animations.anims.push(newFrame);
      }
      map.setCenter(panorama.getPosition());
    });
    // map pov listeners
    google.maps.event.addListener(panorama, 'pov_changed', function() {
        if(recording){
          var newFrame = {"time":recordingTimer,"pitch":panorama.getPov().pitch, "heading":panorama.getPov().heading, "zoom":panorama.getPov().zoom, "k":panorama.getPosition().k,"D":panorama.getPosition().D}
          animations.anims.push(newFrame);
        }
    });
  }
}

// center the map
function center_map() {
  if(map !== undefined){
    var center = map.getCenter();
    document.getElementById("map-canvas").style.width = '303px';
    document.getElementById("map-canvas").style.height = '180px';
    google.maps.event.trigger(map, 'resize');
    map.setCenter(center);
  }
}

// start app
google.maps.event.addDomListener(window, 'load', initialize);
