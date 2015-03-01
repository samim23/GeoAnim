<?php 
  include 'db.php';

  $con = mysql_connect($host,$user,$pass);
  $dbs = mysql_select_db($databaseName, $con);
  
  $id = $_GET['id'];
  $page = $_GET['page'];
  $amount = $_GET['amount'];

  if(isset($id)){
    if($id === "rand"){
      $result = mysql_query("SELECT id,animname,animusername,animdate,animtime,animdata FROM $tableName ORDER BY RAND() LIMIT 1"); 
    }
    else{
      $result = mysql_query("SELECT id,animname,animusername,animdate,animtime,animdata FROM $tableName WHERE (id = $id)"); 
    }
  }
  else{
    if(!isset($page)){ $page = 0;}
    if(!isset($amount)){ $amount = 10;}
    $result = mysql_query("SELECT id,animname,animusername,animdate,animtime FROM $tableName ORDER BY animdate DESC LIMIT $page, $amount");
  }

  $rows = array();
  while ($row = mysql_fetch_row($result)) { $rows[] = $row; }
  echo json_encode($rows);
?>