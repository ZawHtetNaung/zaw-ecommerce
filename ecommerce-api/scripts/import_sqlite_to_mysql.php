<?php

declare(strict_types=1);

use Dotenv\Dotenv;

require __DIR__ . '/../vendor/autoload.php';

$basePath = dirname(__DIR__);

Dotenv::createImmutable($basePath)->safeLoad();

$sqlitePath = $basePath . '/database/database.sqlite';

if (! file_exists($sqlitePath)) {
    fwrite(STDERR, "SQLite database not found at {$sqlitePath}\n");
    exit(1);
}

$mysqlHost = $_ENV['DB_HOST'] ?? '127.0.0.1';
$mysqlPort = (int) ($_ENV['DB_PORT'] ?? 3306);
$mysqlDatabase = $_ENV['DB_DATABASE'] ?? '';
$mysqlUsername = $_ENV['DB_USERNAME'] ?? '';
$mysqlPassword = $_ENV['DB_PASSWORD'] ?? '';

if ($mysqlDatabase === '' || $mysqlUsername === '') {
    fwrite(STDERR, "MySQL environment variables are not configured.\n");
    exit(1);
}

$tables = [
    'users',
    'categories',
    'sub_categories',
    'brands',
    'colors',
    'measurements',
    'events',
    'products',
    'product_images',
    'color_product',
    'measurement_product',
    'banners',
    'personal_access_tokens',
];

$sqlite = new PDO('sqlite:' . $sqlitePath);
$sqlite->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
$sqlite->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);

$mysqlDsn = sprintf(
    'mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4',
    $mysqlHost,
    $mysqlPort,
    $mysqlDatabase
);

$mysql = new PDO($mysqlDsn, $mysqlUsername, $mysqlPassword, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
]);

function sqliteColumns(PDO $connection, string $table): array
{
    $statement = $connection->query(sprintf("PRAGMA table_info('%s')", $table));

    return array_map(
        static fn (array $column): string => $column['name'],
        $statement->fetchAll()
    );
}

function mysqlColumns(PDO $connection, string $table): array
{
    $statement = $connection->query(sprintf('SHOW COLUMNS FROM `%s`', $table));

    return array_map(
        static fn (array $column): string => $column['Field'],
        $statement->fetchAll()
    );
}

function tableExistsInSqlite(PDO $connection, string $table): bool
{
    $statement = $connection->prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = :table LIMIT 1"
    );
    $statement->execute(['table' => $table]);

    return (bool) $statement->fetchColumn();
}

function tableExistsInMysql(PDO $connection, string $table): bool
{
    try {
        $connection->query(sprintf('SHOW COLUMNS FROM `%s`', $table));

        return true;
    } catch (Throwable) {
        return false;
    }
}

$mysql->exec('SET FOREIGN_KEY_CHECKS=0');

foreach (array_reverse($tables) as $table) {
    if (tableExistsInMysql($mysql, $table)) {
        $mysql->exec(sprintf('DELETE FROM `%s`', $table));
    }
}

foreach ($tables as $table) {
    if (! tableExistsInSqlite($sqlite, $table) || ! tableExistsInMysql($mysql, $table)) {
        continue;
    }

    $sourceColumns = sqliteColumns($sqlite, $table);
    $targetColumns = mysqlColumns($mysql, $table);
    $columns = array_values(array_intersect($sourceColumns, $targetColumns));

    if ($columns === []) {
        continue;
    }

    $quotedColumns = implode(', ', array_map(
        static fn (string $column): string => sprintf('"%s"', $column),
        $columns
    ));

    $rows = $sqlite->query(sprintf('SELECT %s FROM "%s"', $quotedColumns, $table))->fetchAll();

    if ($rows === []) {
        echo "Skipped {$table}: no rows\n";
        continue;
    }

    $placeholders = implode(', ', array_fill(0, count($columns), '?'));
    $targetColumnList = implode(', ', array_map(
        static fn (string $column): string => sprintf('`%s`', $column),
        $columns
    ));

    $insert = $mysql->prepare(sprintf(
        'INSERT INTO `%s` (%s) VALUES (%s)',
        $table,
        $targetColumnList,
        $placeholders
    ));

    foreach ($rows as $row) {
        $insert->execute(array_map(
            static fn (string $column) => $row[$column],
            $columns
        ));
    }

    if (in_array('id', $columns, true)) {
        $maxId = max(array_map(static fn (array $row): int => (int) $row['id'], $rows));
        $mysql->exec(sprintf('ALTER TABLE `%s` AUTO_INCREMENT = %d', $table, $maxId + 1));
    }

    echo sprintf("Imported %d row(s) into %s\n", count($rows), $table);
}

$mysql->exec('SET FOREIGN_KEY_CHECKS=1');

echo "SQLite data import completed.\n";
