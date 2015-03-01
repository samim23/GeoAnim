<?php 
	include 'db.php';

  $db = mysql_connect( $host, $user, $pass );
  if (!$db) {
    print "Error connecting to database server: ".mysql_error();
    exit;
  }
  mysql_select_db($databaseName);

  if (isset($_POST['username']) && isset($_POST['animname']) && isset($_POST['animclips']) && isset($_POST['animtime']) )
	{
    $username = mysql_real_escape_string($_POST['username'], $db); 
    $animname = mysql_real_escape_string($_POST['animname'], $db);  
    $animclips = mysql_real_escape_string($_POST['animclips'], $db); 
    $animtime = mysql_real_escape_string($_POST['animtime'], $db); 

    $query = "insert into animations values (NULL, '$animname', NULL, '$username', '$animclips', '$animtime');"; 
    $result = mysql_query($query) or die('Query failed: ' . mysql_error());
    echo "success";
	}
  else{
    echo "error";
  }

?>