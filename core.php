<?php
/*
 * ----------------------------------------------------------------------------
 * Omnex - The Asset Explorer. Everything. Accounted for.
 * ----------------------------------------------------------------------------
 * Author: Julian De Salvador
 * ----------------------------------------------------------------------------
 */

// --- URI OBFUSCATION PARSER ---
$request_uri = $_GET['_url'] ?? '';
$patterns = [
    'type'    => '/\+([^+]+)\+/u',    // +type+
    'view'    => '/¬([^¬]+)¬/u',      // ¬view¬
    'showAll' => '/!([^!]+)!/u'       // !show!
];

foreach ($patterns as $key => $pattern) {
    if (preg_match($pattern, $request_uri, $matches)) {
        $_GET[$key] = $matches[1];
        $request_uri = preg_replace($pattern, '', $request_uri);
    }
}

$folder_path = trim($request_uri, '/');
if (!empty($folder_path)) {
    $_GET['folder'] = $folder_path;
}

// --- CONFIGURATION ---
$assets_dir_name = 'Assets';
$default_format = 'html';

// --- SETUP ---
$current_script = basename(__FILE__);
$current_script_path = realpath(__FILE__);
$script_dir_abs = dirname($current_script_path);

// Define the Absolute Path to the Assets folder
$base_assets_path = realpath($script_dir_abs . DIRECTORY_SEPARATOR . $assets_dir_name);

// Validate Assets Folder Exists
if (!$base_assets_path || !is_dir($base_assets_path)) {
    die("Error: The directory './$assets_dir_name' does not exist. Please create it next to this script.");
}

// --- BASE URL & OFFSET LOGIC ---
function getBaseUrl() {
    $protocol = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? "https" : "http");
    $host = $_SERVER['HTTP_HOST'];
    $dir = str_replace('\\', '/', dirname($_SERVER['PHP_SELF']));
    return $protocol . "://" . $host . rtrim($dir, '/');
}
$base_url_root = getBaseUrl();
$current_api_url = $base_url_root . '/' . $current_script;

// --- REQUEST PARAMS ---

// 1. Folders (Relative to ./Assets/)
$request_folder_param = $_GET['folder'] ?? '';
$valid_roots = [];

if (empty($request_folder_param)) {
    // Default: Show everything in Assets
    $valid_roots[] = ['path' => $base_assets_path, 'name' => 'Root'];
} else {
    // Custom: specific subfolders requested (e.g. Kenney/Car,Kenney/Racing)
    $parts = explode(',', $request_folder_param);
    foreach($parts as $part) {
        $clean_part = trim($part);
        if(empty($clean_part)) continue;

        // Resolve path relative to Assets
        $real = realpath($base_assets_path . DIRECTORY_SEPARATOR . $clean_part);

        // Security check: must be inside Assets dir
        if ($real && is_dir($real) && strpos($real, $base_assets_path) === 0) {
            $valid_roots[] = ['path' => $real, 'name' => $clean_part];
        }
    }
}

// If user asked for specific folders but none were valid, fall back to Assets root
if (empty($valid_roots)) {
    $valid_roots[] = ['path' => $base_assets_path, 'name' => 'Root'];
}

// 2. View/Format/Type
$request_format = $_GET['format'] ?? $default_format;
$request_view = $_GET['view'] ?? ''; // Navigation inside the roots
$request_type = $_GET['type'] ?? '';

$is_html_mode = ($request_format === 'html');
$force_recursive = filter_var($_GET['showAll'] ?? false, FILTER_VALIDATE_BOOLEAN);
$is_recursive = $is_html_mode ? $force_recursive : true;

// 3. Extensions Filter
$allowed_extensions = [];
if (!empty($request_type)) {
    $parts = explode(',', $request_type);
    $allowed_extensions = array_map(fn($ext) => strtolower(trim($ext)), $parts);
}

// --- SCANNING LOGIC ---

// Determine if we are in "Virtual Root" mode (Multiple folders requested, no specific view yet)
$is_virtual_root = (count($valid_roots) > 1 && empty($request_view));

// Determine the actual path to scan if not virtual
$scan_target = '';
$current_relative_view = '';

if (!$is_virtual_root) {
    if (!empty($request_view)) {
        // We are navigating deep. We assume navigation is relative to Assets base for simplicity,
        // OR relative to the first valid root.
        // To keep it simple: View is relative to Assets Base.
        $candidate = realpath($base_assets_path . DIRECTORY_SEPARATOR . $request_view);
        if ($candidate && strpos($candidate, $base_assets_path) === 0 && is_dir($candidate)) {
            $scan_target = $candidate;
        } else {
            $scan_target = $valid_roots[0]['path'];
        }
    } else {
        $scan_target = $valid_roots[0]['path'];
    }

    // Calculate display path relative to Assets
    $current_relative_view = substr($scan_target, strlen($base_assets_path));
    $current_relative_view = ltrim(str_replace('\\', '/', $current_relative_view), '/');
}

// --- CORE FUNCTIONS ---

function formatBytes($bytes, $precision = 2) {
    if ($bytes <= 0) return '0 B';
    $base = log($bytes, 1024);
    $suffixes = ['B', 'KB', 'MB', 'GB', 'TB'];
    return round(pow(1024, $base - floor($base)), $precision) . ' ' . $suffixes[floor($base)];
}

/**
 * Scans a directory and calculates web URLs automatically based on script location.
 */
function scanDirectory($abs_path, $base_assets_path, $script_dir_abs, $base_url_root, $allowed_extensions, $recursive) {
    $results = [];
    if ($abs_path && is_dir($abs_path)) {
        $files = scandir($abs_path);
        foreach ($files as $file) {
            if ($file === '.' || $file === '..') continue;

            $current_abs_path = $abs_path . DIRECTORY_SEPARATOR . $file;

            // Calculate Navigation Path (Relative to Assets Folder for ?view=...)
            $rel_to_assets = substr($current_abs_path, strlen($base_assets_path));
            $rel_to_assets = ltrim(str_replace('\\', '/', $rel_to_assets), '/');

            // Calculate Web URL (Relative to Script Directory)
            // This handles Assets/Kenney/Car automatically
            $rel_to_script = substr($current_abs_path, strlen($script_dir_abs));
            $rel_to_script = ltrim(str_replace('\\', '/', $rel_to_script), '/');
            $web_url = $base_url_root . '/' . $rel_to_script;

            $is_dir = is_dir($current_abs_path);
            $extension = $is_dir ? '' : strtolower(pathinfo($file, PATHINFO_EXTENSION));

            if (!$is_dir && !empty($allowed_extensions) && !in_array($extension, $allowed_extensions)) continue;

            $size_bytes = 0; $size_formatted = ''; $mime = '';
            if (!$is_dir) {
                $size_bytes = filesize($current_abs_path);
                $size_formatted = formatBytes($size_bytes);
                $mime = mime_content_type($current_abs_path) ?: 'application/octet-stream';
            }

            $node = [
                'filename' => $file,
                'extension' => $extension,
                'type' => $is_dir ? 'dir' : 'file',
                'mime_type' => $mime,
                'size_bytes' => $size_bytes,
                'size_formatted' => $size_formatted,
                'relative_path' => $rel_to_assets, // Used for ?view=
                'actual_path' => $web_url // Used for src=
            ];

            if ($is_dir && $recursive) {
                $node['children'] = scanDirectory($current_abs_path, $base_assets_path, $script_dir_abs, $base_url_root, $allowed_extensions, true);
            }
            $results[] = $node;
        }
    }
    return $results;
}

function flattenTree($tree) {
    $flat = [];
    foreach ($tree as $node) {
        $copy = $node; unset($copy['children']); $flat[] = $copy;
        if (isset($node['children'])) $flat = array_merge($flat, flattenTree($node['children']));
    }
    return $flat;
}

// --- LINK GENERATOR ---
$mkLink = function($f = null, $v = null, $t = null, $s = null) use ($is_html_mode) {
    $f = $f ?? ($_GET['folder'] ?? '');
    $v = $v ?? ($_GET['view'] ?? '');
    $t = $t ?? ($_GET['type'] ?? '');
    $s = $s ?? ($_GET['showAll'] ?? '');

    $url = getBaseUrl() . '/' . ltrim($f, '/');
    if (!empty($v)) $url .= "/¬$v¬";
    if (!empty($t)) $url .= "/+$t+";
    if (!empty($s)) $url .= "/!$s!";

    if ($is_html_mode) {
        $url .= '?format=html';
    }
    return $url;
};