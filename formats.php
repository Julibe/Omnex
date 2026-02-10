<?php
require_once 'core.php';

$tree = [];
if ($is_virtual_root) {
    foreach($valid_roots as $root) $tree = array_merge($tree, scanDirectory($root['path'], $base_assets_path, $script_dir_abs, $base_url_root, $allowed_extensions, $is_recursive));
} else {
    $tree = scanDirectory($scan_target, $base_assets_path, $script_dir_abs, $base_url_root, $allowed_extensions, $is_recursive);
}

if ($request_format === 'xml') {
    header('Content-Type: text/xml');
    $xml = new SimpleXMLElement('<root/>');
    foreach($tree as $i) { $e=$xml->addChild('entry'); foreach($i as $k=>$v) if($k!='children') $e->addChild($k,htmlspecialchars($v)); }
    echo $xml->asXML();
} elseif ($request_format === 'csv') {
    header('Content-Type: text/plain');
    $out = fopen('php://output', 'w');
    fputcsv($out, ['filename','extension','type','size','path','url']);
    function flat($t, &$f) { foreach($t as $n) { $c=$n; unset($c['children']); $f[]=$c; if(isset($n['children'])) flat($n['children'],$f); } }
    $rows = []; flat($tree, $rows);
    foreach($rows as $r) fputcsv($out, $r);
} else {
    header('Content-Type: application/json');
    echo json_encode($tree, JSON_PRETTY_PRINT|JSON_UNESCAPED_SLASHES);
}