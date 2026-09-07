<?php
$to = "tu_correo@gmail.com"; // Tu correo real
$subject = "Prueba de correo desde XAMPP";
$message = "Este es un correo de prueba para verificar sendmail.";
$headers = "From: tu_correo@gmail.com\r\n";

if (mail($to, $subject, $message, $headers)) {
    echo "<h1>Correo enviado con éxito</h1>";
} else {
    echo "<h1>Error al enviar el correo</h1>";
}
?>