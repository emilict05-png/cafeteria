<?php
// Configuración de base de datos MySQL / MariaDB
$host = 'sql312.infinityfree.com';
$db   = 'if0_42850024_cafeteria';
$user = 'if0_42850024';
$pass = '05OagY05';
$charset = 'utf8mb4';

$dsn = "mysql:host=$host;dbname=$db;charset=$charset";
$options = [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES   => false,
];

try {
    $pdo = new PDO($dsn, $user, $pass, $options);
} catch (\PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false, 
        'error' => 'Error de conexión a la BD: ' . $e->getMessage() . '. Asegúrate de que MySQL esté activo en XAMPP e importaste database.sql.'
    ]);
    exit;
}
