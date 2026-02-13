<?php
	/*
		* ----------------------------------------------------------------------------
		* Omnex - The Asset Explorer where everything is accounted for
		* ----------------------------------------------------------------------------
		* Version: 4.1.4
		* Description:
		* Omnex is a modern, intuitive asset management system built to explore, track,
		* and understand all your assets in one place. With support for multiple file
		* types, powerful filtering, and a refined interface, Omnex delivers complete
		* visibility and control, ensuring nothing is overlooked.
		*
		* Start exploring and take control of your digital world with Omnex.
		*
		* Author:
		* Julibe - Crafting Digital Experiences
		* UI/UX, Web, VR, AR, and Interactive Systems
		*
		* About:
		* Hi! I’m Julibe 👻 A supercool Designer with
		* +18 years of experience in web, apps,
		* UX/UI, VR, AR, and AI. Lover of sci-fi, TV, anime,
		* and a pro at game overs since the '90s! 🕹️
		*
		* Website: https://julibe.com/
		* Email: mail@julibe.com
		* Copyright: © 2026
		* ----------------------------------------------------------------------------
	*/

	// --- DYNAMIC DATE ENGINE ---
	// Automatically sets dates to the 1st of the current month
	try {
		$now = new DateTime('now');
		$current_year = $now->format('Y');

		// Force date to YYYY-MM-01 01:41:00 (preserving your preferred time)
		$start_of_month = new DateTime($now->format('Y-m-01 01:41:00'));

		$meta_date_simple = $start_of_month->format('Y-m-d'); // 2026-02-01
		$meta_date_iso = $start_of_month->format('c'); // ISO 8601 with Offset

		// Expiration: +1 Year from now
		$expire_date = clone $start_of_month;
		$expire_date->modify('+1 year');
		$meta_date_exp = $expire_date->format('c');
	} catch (Exception $e) {
		// Fallback if Date fails
		$current_year = '2026';
		$meta_date_simple = '2026-01-01';
		$meta_date_iso = '2026-01-01T00:00:00-00:00';
		$meta_date_exp = '2027-01-01T00:00:00-00:00';
	}

	// --- CONFIGURATION ---
	$assets_dir_name = 'Assets';
	$default_format = 'html';
	$default_accent = 'd946ef';
	$appName = 'Omnex';
	$appDesc = 'The Asset Explorer where everything is accounted for';
	$appAuthor = 'By Julibe';
	$appKeys = [$appName, 'Julibe', 'Love','asset explorer', 'file manager', 'media library', 'digital vault', 'content tracker', 'resource hub', 'data organizer', 'file catalog', 'asset dashboard'];
	$appInfo = $appName . ' is here to help you explore, track, and understand all your assets in one place. Everything accounted for. Start exploring today. Developed with ❤️ ' . $appAuthor . '.';

	// --- DYNAMIC UI THEME ENGINE ---
	$ui_color = $_GET['color'] ?? $default_accent;

	// Strict HEX validation
	if (!preg_match('/^[a-f0-9]{6}$/i', $ui_color)) {
		$ui_color = $default_accent;
	}

	// Full decomposition of HEX to RGB
	list($r_val, $g_val, $b_val) = sscanf($ui_color, "%02x%02x%02x");
	$accent_glow_rgba = "rgba($r_val, $g_val, $b_val, 0.15)";
	$accent_border_rgba = "rgba($r_val, $g_val, $b_val, 0.4)";
	$selection_bg_rgba = "rgba($r_val, $g_val, $b_val, 0.3)";

	function stringToColor($str_input) {
		$hash_val = md5(rand(1,99).$str_input);
		return substr($hash_val, 0, 6);
	}

	// --- SYSTEM INITIALIZATION ---
	$current_script = basename(__FILE__);
	$current_script_path = realpath(__FILE__);
	$script_dir_abs = dirname($current_script_path);

	// Establish the Absolute Path to the Assets repository
	$base_assets_path = realpath($script_dir_abs . DIRECTORY_SEPARATOR . $assets_dir_name);

	if (!$base_assets_path || !is_dir($base_assets_path)) {
		die("CRITICAL ERROR: The directory './$assets_dir_name' was not found in the filesystem.");
	}

	// --- REQUEST PARAMETER PROCESSING ---
	$request_folder_param = $_GET['folder'] ?? '';
	$valid_roots = [];

	if (empty($request_folder_param)) {
		$valid_roots[] = ['path' => $base_assets_path, 'name' => 'Home'];
	} else {
		$folder_parts = explode(',', $request_folder_param);
		foreach($folder_parts as $p) {
			$clean_p = trim($p);
			if(empty($clean_p)) continue;
			$real_p = realpath($base_assets_path . DIRECTORY_SEPARATOR . $clean_p);
			if ($real_p && is_dir($real_p) && strpos($real_p, $base_assets_path) === 0) {
				$valid_roots[] = ['path' => $real_p, 'name' => $clean_p];
			}
		}
	}

	if (empty($valid_roots)) {
		$valid_roots[] = ['path' => $base_assets_path, 'name' => 'Home'];
	}

	$request_format = $_GET['format'] ?? $default_format;
	$request_view = $_GET['view'] ?? '';
	$request_type = $_GET['type'] ?? '';

	$is_html_mode = ($request_format === 'html');
	$force_recursive = filter_var($_GET['showAll'] ?? false, FILTER_VALIDATE_BOOLEAN);
	$is_recursive = $is_html_mode ? $force_recursive : true;

	// --- PAGINATION PARAMETERS ---
	$items_per_page = isset($_GET['limit']) ? (int)$_GET['limit'] : 20;
	if ($items_per_page < 1) $items_per_page = 20;
	$current_page = isset($_GET['page']) ? (int)$_GET['page'] : 1;
	if ($current_page < 1) $current_page = 1;

	$allowed_extensions = [];
	if (!empty($request_type)) {
		$type_parts = explode(',', $request_type);
		$allowed_extensions = array_map(fn($e) => strtolower(trim($e)), $type_parts);
	}

	// --- URL CONSTRUCTION ENGINE ---
	function getBaseUrl() {
		$server_proto = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? "https" : "http");
		$server_host = $_SERVER['HTTP_HOST'];
		$server_dir = str_replace('\\', '/', dirname($_SERVER['PHP_SELF']));
		return $server_proto . "://" . $server_host . rtrim($server_dir, '/');
	}
	$base_url_root = getBaseUrl();
	$current_api_url = $base_url_root . '/' . $current_script;

	// --- DIRECTORY SCANNING LOGIC ---
	$is_virtual_root = (count($valid_roots) > 1 && empty($request_view));
	$scan_target = '';
	$current_relative_view = '';

	if (!$is_virtual_root) {
		if (!empty($request_view)) {
			$target_candidate = realpath($base_assets_path . DIRECTORY_SEPARATOR . $request_view);
			if ($target_candidate && strpos($target_candidate, $base_assets_path) === 0 && is_dir($target_candidate)) {
				$scan_target = $target_candidate;
			} else {
				$scan_target = $valid_roots[0]['path'];
			}
		} else {
			$scan_target = $valid_roots[0]['path'];
		}
		$current_relative_view = substr($scan_target, strlen($base_assets_path));
		$current_relative_view = ltrim(str_replace('\\', '/', $current_relative_view), '/');
	}

	// --- CORE UTILITY FUNCTIONS ---
	function formatBytes($byte_count, $precision_val = 2) {
		if ($byte_count <= 0) return '0 B';
		$log_val = log($byte_count, 1024);
		$suffixes = ['B', 'KB', 'MB', 'GB', 'TB'];
		return round(pow(1024, $log_val - floor($log_val)), $precision_val) . ' ' . $suffixes[floor($log_val)];
	}

	function scanDirectory($abs_path, $base_assets_path, $script_dir_abs, $base_url_root, $allowed_extensions, $recursive) {
		$scan_results = [];
		if ($abs_path && is_dir($abs_path)) {
			$dir_files = scandir($abs_path);
			foreach ($dir_files as $f_item) {
				if ($f_item === '.' || $f_item === '..') continue;

				$item_abs_path = $abs_path . DIRECTORY_SEPARATOR . $f_item;
				$item_rel_to_assets = substr($item_abs_path, strlen($base_assets_path));
				$item_rel_to_assets = ltrim(str_replace('\\', '/', $item_rel_to_assets), '/');
				$item_rel_to_script = substr($item_abs_path, strlen($script_dir_abs));
				$item_rel_to_script = ltrim(str_replace('\\', '/', $item_rel_to_script), '/');
				$item_web_url = $base_url_root . '/' . $item_rel_to_script;

				$is_folder = is_dir($item_abs_path);
				$item_ext = $is_folder ? '' : strtolower(pathinfo($f_item, PATHINFO_EXTENSION));

				if (!$is_folder && !empty($allowed_extensions) && !in_array($item_ext, $allowed_extensions)) continue;

				$s_bytes = 0; $s_formatted = ''; $m_type = '';
				if (!$is_folder) {
					$s_bytes = filesize($item_abs_path);
					$s_formatted = formatBytes($s_bytes);
					$m_type = mime_content_type($item_abs_path) ?: 'application/octet-stream';
				}

				$node_data = [
					'filename' => $f_item,
					'extension' => $item_ext,
					'type' => $is_folder ? 'dir' : 'file',
					'mime_type' => $m_type,
					'size_bytes' => $s_bytes,
					'size_formatted' => $s_formatted,
					'relative_path' => $item_rel_to_assets,
					'actual_path' => $item_web_url
				];

				if ($is_folder && $recursive) {
					$node_data['children'] = scanDirectory($item_abs_path, $base_assets_path, $script_dir_abs, $base_url_root, $allowed_extensions, true);
				}
				$scan_results[] = $node_data;
			}
		}
		return $scan_results;
	}

	function flattenTree($tree_input) {
		$flat_output = [];
		foreach ($tree_input as $node_item) {
			$node_copy = $node_item; unset($node_copy['children']); $flat_output[] = $node_copy;
			if (isset($node_item['children'])) $flat_output = array_merge($flat_output, flattenTree($node_item['children']));
		}
		return $flat_output;
	}

	// --- API RENDERERS ---
	function renderJson($data_payload) { header('Access-Control-Allow-Origin: *'); header('Content-Type: application/json'); echo json_encode($data_payload, JSON_PRETTY_PRINT|JSON_UNESCAPED_SLASHES); }
	function renderXml($data_payload) {
		header('Access-Control-Allow-Origin: *'); header('Content-Type: text/xml');
		$xml_obj = new SimpleXMLElement('<root/>');
		foreach($data_payload as $item_node) { $e_node=$xml_obj->addChild('entry'); foreach($item_node as $k_key=>$v_val) if($k_key!='children') $e_node->addChild($k_key,htmlspecialchars($v_val)); }
		echo $xml_obj->asXML();
	}
	function renderCsv($data_payload) {
		header('Access-Control-Allow-Origin: *'); header('Content-Type: text/plain');
		$csv_out = fopen('php://output', 'w'); fputcsv($csv_out, ['filename','extension','type','mime','size','path','url']);
		foreach (flattenTree($data_payload) as $csv_row) fputcsv($csv_out, $csv_row); fclose($csv_out);
	}

	// --- UI COMPONENT RENDERER ---
	function renderHtml($currentItems, $apiUrl, $currentRelPath, $isVirtual, $hexColor, $glowRgba, $borderRgba, $selectRgba, $defaultHex, $appAuthor,$appName, $appDesc, $appInfo, $appKeys, $page, $limit, $current_year, $meta_date_simple, $meta_date_iso, $meta_date_exp) {

		usort($currentItems, function($a_node, $b_node) {
			if ($a_node['type'] !== $b_node['type']) return $a_node['type'] === 'dir' ? -1 : 1;
			return strnatcasecmp($a_node['filename'], $b_node['filename']);
		});

		// Apply Pagination
		$total_items = count($currentItems);
		$total_pages = ceil($total_items / $limit);
		$offset = ($page - 1) * $limit;
		$paged_items = array_slice($currentItems, $offset, $limit);

		$ui_breadcrumbs = [];
		if (!$isVirtual && $currentRelPath) {
			$path_parts = array_filter(explode('/', $currentRelPath));
			$path_acc = '';
			foreach ($path_parts as $p_part) {
				$path_acc .= ($path_acc === '' ? '' : '/') . $p_part;
				$ui_breadcrumbs[] = ['name' => $p_part, 'path' => trim($path_acc, '/')];
			}
		}

		$mkLink = function($params = []) use ($defaultHex, $page, $limit) {
			$query = $_GET;
			unset($query['format']);
			if (!isset($query['limit']) && $limit !== 20) $query['limit'] = $limit;
			foreach ($params as $key => $val) {
				if ($val === null) unset($query[$key]);
				else $query[$key] = $val;
			}
			return '?' . http_build_query($query);
		};

		$mkApiLink = function($link_format) use ($apiUrl) {
			$url_q = $_GET;
			$url_q['format'] = $link_format;
			return $apiUrl . '?' . http_build_query($url_q);
		};

		$filter_groups = [
			'3D' => ['glb','gltf','obj','fbx'],
			'Images' => ['jpg', 'jpeg', 'png', 'gif', 'webp', 'tiff', 'heic', 'avif','svg'],
			'Video' => ['mp4', 'webm', 'mov', 'mkv','m4v', 'avi', 'flv', 'wmv', 'mts', 'ts', 'ogv', 'vp9'],
			'Audio' => ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'opus', 'weba'],
			'Code' => ['js','ts','jsx','tsx','html','css','scss','sass','json','xml','php','txt','md','yml'],
			'Documents' => ['pdf','doc','docx','xls','xlsx','ppt','pptx','txt','md'],
			'Archives' => ['zip','rar','7z','tar','gz'],

		];
	?>
	<!DOCTYPE html>
	<html lang="en">
	<head>
		<title><?php echo $appName; ?> | <?php echo $appDesc; ?> | <?php echo $appAuthor; ?> ❤️</title>
		<meta http-equiv="content-type" content="text/html; charset=UTF-8">
		<meta charset="UTF-8">
		<meta http-equiv="X-UA-Compatible" content="IE=edge">
		<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
		<base href="./">
		<meta property="name" content="<?php echo $appName; ?>">
		<meta name="name" content="<?php echo $appName; ?>">
		<meta name="theme-color" content="#171420">
		<meta name="mobile-web-app-capable" content="yes">
		<meta name="application-name" content="<?php echo $appName; ?>">
		<link rel="manifest" href="./manifest.json">
		<link rel="shortcut icon" href="./media/icon.webp">
		<link rel="icon" type="image/png" href="./media/icon.webp">
		<meta http-equiv="Content-Security-Policy" content="frame-ancestors 'none';">
		<meta http-equiv="X-Content-Type-Options" content="nosniff">
		<meta http-equiv="X-Frame-Options" content="SAMEORIGIN">
		<meta http-equiv="X-XSS-Protection" content="1; mode=block">
		<meta name="description" content="<?php echo $appInfo;?>">
		<meta name="keywords" content="<?php echo implode(',', $appKeys); ?>">
		<meta name="author" content="Julibe">
		<meta name="robots" content="index, follow">
		<meta name="googlebot" content="index, follow">
		<meta name="bingbot" content="index, follow">
		<meta name="referrer" content="origin-when-cross-origin">
		<meta name="rating" content="general">
		<meta name="revisit-after" content="7 days">
		<link rel="canonical" href="./">
		<link rel="alternate" href="https://julibe.com/" hreflang="x-default">
		<meta name="p:domain_verify" content="194c03ce4137043917b6eeafb295fcbb">
		<meta name="location.country" content="US">
		<meta property="og:site_name" content="<?php echo $appName; ?>">
		<meta property="og:title" content="<?php echo $appName; ?> | <?php echo $appDesc; ?> | <?php echo $appAuthor; ?> ❤️">
		<meta property="og:description" content="<?php echo $appInfo;?>">
		<meta property="og:type" content="website">
		<meta property="og:locale" content="en_US">
		<meta property="og:url" content="./">
		<meta property="og:image" content="https://apps.julibe.com/media/vexom/./media/vexom/none-image.webp">
		<meta property="og:image:secure_url" content="https://apps.julibe.com/media/vexom/./media/vexom/none-image.webp">
		<meta property="og:image:alt" content="<?php echo $appName; ?> helps you explore, track, and understand all your assets in one place. Everything accounted for. Start exploring today.">
		<meta property="og:email" content="mail@julibe.com">
		<meta property="og:country-name" content="US">
		<meta property="al:web:url" content="./">
		<meta name="twitter:title" content="<?php echo $appName; ?> | <?php echo $appDesc; ?> | <?php echo $appAuthor; ?> ❤️">
		<meta name="twitter:description" content="<?php echo $appInfo;?>">
		<meta name="twitter:site" content="@julibe">
		<meta name="twitter:creator" content="@julibe">
		<meta name="twitter:url" content="./">
		<meta name="twitter:domain" content="https://julibe.com/">
		<meta name="twitter:card" content="summary_large_image">
		<meta name="twitter:image" content="https://apps.julibe.com/media/vexom/./media/vexom/none-image.webp">
		<meta name="twitter:image:src" content="https://apps.julibe.com/media/vexom/./media/vexom/none-image.webp">
		<meta name="twitter:image:alt" content="<?php echo $appName; ?> helps you explore, track, and understand all your assets in one place. Everything accounted for. Start exploring today.">
		<meta name="apple-mobile-web-app-capable" content="yes">
		<meta name="apple-mobile-web-app-status-bar-style" content="default">
		<meta name="apple-mobile-web-app-title" content="<?php echo $appName; ?>">
		<link rel="apple-touch-icon" href="./media/icon.webp">
		<link rel="apple-touch-startup-image" href="https://apps.julibe.com/media/vexom/./media/vexom/none-image.webp">
		<meta name="msapplication-TileColor" content="#171420">
		<meta name="msapplication-TileImage" content="./media/icon.webp">
		<meta name="msapplication-config" content="none">
		<meta name="msapplication-navbutton-color" content="#171420">
		<meta name="msapplication-tooltip" content="<?php echo $appInfo;?>">
		<meta name="msapplication-starturl" content="./">
		<meta name="datacite.creator" content="Julibe">
		<meta name="datacite.title" content="<?php echo $appName; ?> | <?php echo $appDesc; ?> | <?php echo $appAuthor; ?> ❤️">
		<meta name="datacite.publisher" content="Julibe">
		<meta name="datacite.resourceType" content="InteractiveResource">
		<meta name="datacite.subject" content="<?php echo implode(',', $appKeys); ?>">
		<meta name="datacite.description" content="<?php echo $appInfo;?>">
		<meta name="datacite.language" content="en">
		<meta name="datacite.url" content="./">

		<!-- DYNAMIC DATES -->
		<meta name="copyright" content="<?php echo $current_year; ?>">
		<meta name="date" content="<?php echo $meta_date_simple; ?>">
		<meta name="modified" content="<?php echo $meta_date_simple; ?>">
		<meta property="article:published_time" content="<?php echo $meta_date_iso; ?>">
		<meta property="article:modified_time" content="<?php echo $meta_date_iso; ?>">
		<meta property="article:expiration_time" content="<?php echo $meta_date_exp; ?>">
		<meta name="datacite.publicationYear" content="<?php echo $current_year; ?>">
		<meta name="datacite.dateIssued" content="<?php echo $meta_date_simple; ?>">

		<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','GTM-TFV56799');</script>
		<script async src="https://www.googletagmanager.com/gtag/js?id=G-416Q6HW7MT"></script>
		<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-416Q6HW7MT');</script>
		<script type="text/javascript">(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window, document, "clarity", "script", "v20xjtjk1h");</script>
		<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token":"0948b735ca7842359091b2bd8fdefb54"}'></script>
		<script>const firebaseConfig={"apiKey":"AIzaSyDhRbFy9m-NXZVkozYJwKdDYJuwsL6W_bw","authDomain":"pushnotificationsio.firebaseapp.com","databaseURL":"https:\/\/pushnotificationsio.firebaseio.com","projectId":"pushnotificationsio","storageBucket":"pushnotificationsio.appspot.com","messagingSenderId":"788493704860","appId":"1:788493704860:web:ba71fd692e7cc9651f5759","measurementId":"G-NXS0Z75BCH"};</script>
		<script type="application/ld+json">{ "@context": "https://schema.org", "@type": "WebSite", "name": "<?php echo $appName; ?> | <?php echo $appDesc; ?> | <?php echo $appAuthor; ?> ❤️", "url": "./", "description": "<?php echo $appInfo;?>", "author": { "@type": "Person", "name": "Julibe" }, "image": "https://apps.julibe.com/media/vexom/./media/vexom/none-image.webp", "dateCreated": "<?php echo $meta_date_simple; ?>", "dateModified": "<?php echo $meta_date_simple; ?>", "inLanguage": "en"}</script>

		<link rel="stylesheet" href="styles/styles.css">
		<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
		<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism-tomorrow.min.css">
		<script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/prism.min.js"></script>
		<script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-php.min.js"></script>
		<script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-javascript.min.js"></script>
		<script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-css.min.js"></script>
		<script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-json.min.js"></script>
		<script type="module" src="https://unpkg.com/@google/model-viewer@4.0.0/dist/model-viewer.min.js"></script>
		<script src="https://unpkg.com/exifreader@4.12.0/dist/exif-reader.min.js"></script>
		<script src="https://unpkg.com/wavesurfer.js@7"></script>
		<style>
			:root {
				--accent: #<?php echo $hexColor; ?>;
				--accent_glow: <?php echo $glowRgba; ?>;
				--accent_border: <?php echo $borderRgba; ?>;
				--selection_bg: <?php echo $selectRgba; ?>;
			}
			.token.keyword, .token.selector, .token.attr-name { color: var(--accent) !important; }
		</style>
	</head>
	<body>
		<div class="app-container">
			<button class="menu-toggle" onclick="toggleSidebar()"><i class="fa-solid fa-bars"></i></button>
			<aside class="sidebar" id="mainSidebar">
				<div class="user-profile">
					<div class="avatar"><i class="fa-solid fa-boxes-stacked"></i></div>
					<div class="info">
						<span class="name"><?php echo $appName; ?> <?php echo $appAuthor; ?></span>
						<span class="slogan"><?php echo $appDesc; ?></span>
					</div>
				</div>
				<nav class="nav-section">
					<div class="nav-head">Navigation</div>
					<a href="<?php echo $mkLink(['view'=>null, 'type'=>null, 'page'=>1]); ?>" class="nav-link <?php echo $currentRelPath===''?'active':''; ?>"><i class="fa-solid fa-house"></i> Home</a>
				</nav>
				<nav class="nav-section">
					<div class="nav-head">Folders</div>
					<div class="folder-list">
						<?php foreach ($currentItems as $f_node):
							if ($f_node['type'] !== 'dir') continue;
							$node_f_color = stringToColor($f_node['filename']);
						?>
							<a href="<?php echo $mkLink(['view'=>$f_node['relative_path'],'color'=>$node_f_color, 'page'=>1]); ?>"
							class="nav-link"
							style="--folder-hue: #<?php echo $node_f_color; ?>;">
							<i class="fa-solid fa-folder" style="color: var(--folder-hue);"></i> <?php echo $f_node['filename']; ?>
							</a>
						<?php endforeach; ?>
					</div>
				</nav>
				<nav class="nav-section">
					<div class="nav-head">Filters</div>
					<a href="<?php echo $mkLink(['type'=>null, 'page'=>1]); ?>" class="nav-link <?php echo empty($_GET['type'])?'active':''; ?>"><i class="fa-solid fa-layer-group"></i> All Files</a>
					<?php foreach ($filter_groups as $g_name => $g_exts):
						$g_types_str = implode(',', $g_exts);
						$g_icon = 'fa-wand-magic-sparkles';
						switch($g_name) {
							case '3D': $g_icon = 'fa-cube'; $description = '🎯 Explore stunning 3D Models (GLB, GLTF, OBJ, FBX) - Interactive 3D assets that bring your world to life!'; break;
							case 'Images': $g_icon = 'fa-image'; $description = '🎨 Discover all Image Files (JPG, PNG, GIF, WebP, SVG, HEIC, AVIF, TIFF) - Every format, every visual!'; break;
							case 'Video': $g_icon = 'fa-film'; $description = '🎬 Play all Video Files (MP4, WebM, MOV, MKV, AVI, FLV, WMV) - Cinema quality at your fingertips!'; break;
							case 'Audio': $g_icon = 'fa-music'; $description = '🎵 Stream all Audio Files (MP3, WAV, OGG, FLAC, AAC, M4A, Opus) - Feel the beat, every format!'; break;
							case 'Code': $g_icon = 'fa-code'; $description = '💻 Master all Code Files (JS, TS, HTML, CSS, PHP, JSON, XML, MD) - Code like a pro!'; break;
							case 'Documents': $g_icon = 'fa-file-lines'; $description = '📄 Access all Document Files (PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX) - Business at your command!'; break;
						}
						$col = stringToColor($g_name);
					?>
						<a href="<?php echo $mkLink(['type'=>$g_types_str, 'page'=>1, 'color'=>$col]); ?>" class="nav-link <?php echo (isset($_GET['type']) && $_GET['type'] === $g_types_str)?'active':''; ?>" title="<?php echo $description; ?>" aria-label="Filter assets by <?php echo $g_name; ?>"><i class="fa-solid <?php echo $g_icon; ?>" style="color: #<?php echo $col; ?>;"	></i> <?php echo $g_name; ?></a>
					<?php endforeach; ?>
				</nav>
			</aside>

			<main class="content-area">
				<header class="main-header">
					<div class="search-box">
						<span class="icon"><i class="fa-solid fa-magnifying-glass"></i></span>
						<input type="text" id="assetSearch" placeholder="Search Assets..." onkeyup="filterGrid()">
					</div>
					<div class="api-controls">
						<a href="<?php echo $mkApiLink('json'); ?>" target="_blank" class="btn">{JSON}</a>
						<a href="<?php echo $mkApiLink('xml'); ?>" target="_blank" class="btn">&lt;XML&gt;</a>
						<a href="<?php echo $mkApiLink('csv'); ?>" target="_blank" class="btn">[CSV]</a>
					</div>
				</header>

				<div class="view-header">
					<div class="breadcrumbs">
						<a href="<?php echo $mkLink(['view'=>null, 'page'=>1]); ?>"><i class="fa-solid fa-house-chimney"></i> Root</a>
						<?php foreach ($ui_breadcrumbs as $crumb_node): ?>
							<span class="sep">/</span><a href="<?php echo $mkLink(['view'=>$crumb_node['path'], 'page'=>1]); ?>"><?php echo $crumb_node['name']; ?></a>
						<?php endforeach; ?>
					</div>
				</div>

				<div class="asset-grid" id="assetGrid">
					<?php
					if(empty($paged_items)): ?>
						<div style="grid-column: 1/-1; text-align:center; padding: 2rem; color: var(--text_dim);">No items found.</div>
					<?php endif;
					foreach ($paged_items as $idx => $a_item):
						$a_ext = $a_item['extension'];
						$is_a_dir = $a_item['type'] === 'dir';
						$a_item['color'] = stringToColor($a_item['filename']);
						$is_a_image = in_array($a_ext, ['jpg','jpeg','png','gif','webp','svg']);
						$a_b64 = base64_encode(json_encode($a_item));
						$a_click = $is_a_dir
							? "window.location.href='" . $mkLink(['view'=>$a_item['relative_path'], 'page'=>1]) . "'"
							: "openViewer(this)";
					?>
					<div class="card interactive-card" data-b64="<?php echo $a_b64; ?>" data-name="<?php echo strtolower($a_item['filename']); ?>" onclick="<?php echo $a_click; ?>" style="--delay: <?php echo $idx * 0.05; ?>s">
						<?php if(!$is_a_dir): ?><div class="badge"><?php echo $a_ext; ?></div><?php endif; ?>
						<div class="icon">
							<div class="magnetic-element">
								<?php if ($is_a_image): ?>
									<img loading="lazy" src="<?php echo $a_item['actual_path']; ?>" alt="">
								<?php else: ?>
									<div class="fallback-icon">
										<i class="fa-solid <?php
										if($is_a_dir) echo 'fa-folder-closed';
										elseif(in_array($a_ext, ['glb','gltf','obj','fbx'])) echo 'fa-cube';
										elseif(in_array($a_ext, ['mp4', 'webm', 'mov', 'mkv','m4v', 'avi', 'flv', 'wmv', 'mts', 'ts', 'ogv', 'vp9'])) echo 'fa-film';
										elseif(in_array($a_ext, ['mp3','wav','ogg','flac','aac','m4a','opus','weba'])) echo 'fa-music';
										elseif(in_array($a_ext, ['js','ts','jsx','tsx','html','css','scss','sass','json','xml','php','txt','md','yml'])) echo 'fa-code';
										elseif(in_array($a_ext, ['pdf','doc','docx','xls','xlsx','ppt','pptx'])) echo 'fa-file-lines';
										elseif(in_array($a_ext, ['zip','rar','7z','tar','gz'])) echo 'fa-file-zipper';
										elseif(in_array($a_ext, ['exe','msi','dmg'])) echo 'fa-computer';
										else echo 'fa-file-lines';
										?>" <?php if($is_a_dir && isset($a_item['color'])) { ?>style="color: #<?php echo $a_item['color']; ?>;"<?php } ?>></i>
									</div>
								<?php endif; ?>
							</div>
						</div>
						<div class="info">
							<span class="name" title="<?php echo $a_item['filename']; ?>"><?php echo $a_item['filename']; ?></span>
							<span class="meta"><?php echo $is_a_dir ? 'Folder' : $a_item['size_formatted']; ?></span>
						</div>
					</div>
					<?php endforeach; ?>
				</div>

				<!-- PAGINATION CONTROLS -->
				<?php if ($total_pages > 1): ?>
				<div class="pagination-container">
					<div class="page-info">
						Showing <?php echo $offset + 1; ?>-<?php echo min($offset + $limit, $total_items); ?> of <?php echo $total_items; ?>
					</div>
					<div class="page-controls">
						<a href="<?php echo ($page > 1) ? $mkLink(['page'=>$page-1,'limit'=>$limit]) : '#'; ?>" class="btn <?php echo ($page <= 1) ? 'disabled' : ''; ?>"><i class="fa-solid fa-chevron-left"></i></a>
						<span class="current-page"><?php echo $page; ?> / <?php echo $total_pages; ?></span>
						<a href="<?php echo ($page < $total_pages) ? $mkLink(['page'=>$page+1,'limit'=>$limit]) : '#'; ?>" class="btn <?php echo ($page >= $total_pages) ? 'disabled' : ''; ?>"><i class="fa-solid fa-chevron-right"></i></a>
					</div>
				</div>
				<?php endif; ?>

				<footer role="contentinfo">
					<nav aria-label="Social Media Navigation">
						<ul class="socials">
							<li> <a href="http://julibe.com/" title="Enter Julibe’s awesome realm 👻" aria-label="Visit Julibe's Portfolio" target="_social" rel="noopener noreferrer" class="button social-button" style="--c:#7139d2ff; --c-text:#ffffff; --c-high:#ee355e;" > <span class="icon fa fa-solid fa-globe"></span> <span class="title">Portfolio</span> </a> </li>
							<li> <a href="http://julibe.com/github" title="“Copy… Argh! 🏴‍☠️” I mean, explore Julibe’s code" aria-label="Julibe's GitHub" target="_social" rel="noopener noreferrer" class="button social-button" style="--c:#625b68ff; --c-text:#ffffff; --c-high:#6b1ed0ff;" > <span class="icon fa-brands fa-github"></span> <span class="title">GitHub</span> </a> </li>
							<li> <a href="http://julibe.com/whatsapp" title="💬 Message Julibe and say hi or just Boo!" aria-label="Contact Julibe via WhatsApp" target="_social" rel="noopener noreferrer" class="button social-button" style="--c:#25d366; --c-text:#ffffff; --c-high:#30676a;" > <span class="icon fa-brands fa-whatsapp"></span> <span class="title">WhatsApp</span> </a> </li>
							<li> <a href="http://julibe.com/twitter" title="Get some of Julibe's thoughts, pixels, and the occasional rant 🐦" aria-label="Follow Julibe on Twitter" target="_social" rel="noopener noreferrer" class="button social-button" style="--c:#1da1f2; --c-text:#ffffff; --c-high:#1da1f2;" > <span class="icon fa-brands fa-twitter"></span> <span class="title">X (Twitter)</span> </a> </li>
							<li> <a href="http://julibe.com/instagram" title="Peek behind the scenes of Julibe’s creative stuff 📸" aria-label="Follow Julibe on Instagram" target="_social" rel="noopener noreferrer" class="button social-button" style="--c:#e1306c; --c-text:#ffffff; --c-high:#e1306c;" > <span class="icon fa-brands fa-instagram"></span> <span class="title">Instagram</span> </a> </li>
							<li> <a href="mailto:mail@julibe.com" title="Send a good old digital email to Julibe 📧" aria-label="Send Email to Julibe" target="_social" rel="noopener noreferrer" class="button social-button" style="--c:#de4138; --c-text:#ffffff; --c-high:#edba1c;"> <span class="icon fa fa-solid fa-envelope"></span> <span class="title">Email</span> </a> </li>
						</ul>
					</nav>
					<p style="margin-top:1rem; font-size:0.75rem; text-align:center; color: var(--text_dim);">© <?php echo $current_year; ?> <?php echo $appName; ?>. All rights reserved. Crafted with ❤️ <?php echo $appAuthor; ?> .</p>
				</footer>
			</main>
		</div>

		<div class="modal-overlay" id="modal">
			<div class="modal-content">
				<div class="modal-header">
					<h3 id="mTitle" style="margin:0"></h3>
					<button class="close-btn" onclick="closeModal()"><i class="fa-solid fa-xmark"></i></button>
				</div>
				<div class="modal-body" id="mBody"></div>
				<div class="modal-footer">
					<span id="mMeta" style="color:#aaa;font-size:0.8rem"></span>
					<a id="mDown" href="#" target="_blank" class="btn primary"><i class="fa-solid fa-up-right-from-square"></i> Open Original</a>
				</div>
			</div>
		</div>
		<div id="toast" class="toast"></div>
		<script src="script/script.js"></script>
	</body>
	</html>
	<?php
	}

	if ($is_html_mode) {
		$gather_items = [];
		if ($is_virtual_root) {
			foreach($valid_roots as $r_node) {
				$r_path_rel = substr($r_node['path'], strlen($base_assets_path));
				$r_path_rel = ltrim(str_replace('\\', '/', $r_path_rel), '/');
				$gather_items[] = [
					'filename' => $r_node['name'], 'extension' => '', 'type' => 'dir', 'mime_type' => '',
					'size_bytes' => 0, 'size_formatted' => '',
					'relative_path' => $r_path_rel,
					'actual_path' => '',
					'color' => stringToColor($r_node['name'])
				];
			}
		} else {
			$gather_items = scanDirectory($scan_target, $base_assets_path, $script_dir_abs, $base_url_root, $allowed_extensions, false);
		}
		// Pass paging data + date variables to the HTML renderer
		renderHtml($gather_items, $current_api_url, $current_relative_view, $is_virtual_root, $ui_color, $accent_glow_rgba, $accent_border_rgba, $selection_bg_rgba, $default_accent, $appAuthor,$appName, $appDesc, $appInfo, $appKeys, $current_page, $items_per_page, $current_year, $meta_date_simple, $meta_date_iso, $meta_date_exp);
	} else {
		// API Renders full tree (No Pagination)
		$api_tree = [];
		if ($is_virtual_root) {
			foreach($valid_roots as $root_node) {
				$api_tree = array_merge($api_tree, scanDirectory($root_node['path'], $base_assets_path, $script_dir_abs, $base_url_root, $allowed_extensions, $is_recursive));
			}
		} else {
			$api_tree = scanDirectory($scan_target, $base_assets_path, $script_dir_abs, $base_url_root, $allowed_extensions, $is_recursive);
		}
		if ($request_format === 'json') renderJson($api_tree);
		elseif ($request_format === 'xml') renderXml($api_tree);
		else renderCsv($api_tree);
	}
?>