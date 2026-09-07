<?php
// mailer.php - Servicio de Notificaciones por Correo Electrónico
function enviarCorreoNotificacion($pdo, $id_venta, $email_destinatario, $nombre_cliente, $tipo, $tiempo_estimado = 15) {
    $asunto = '';
    $cuerpo = '';

    if ($tipo === 'tiempo_recoleccion') {
        $asunto = "☕ Pedido #$id_venta recibido - Tiempo estimado de recolección: {$tiempo_estimado} min";
        $cuerpo = "¡Hola $nombre_cliente!

"
                . "Hemos recibido tu pedido #$id_venta en Café con Leche.
"
                . "⏱️ Tiempo estimado de preparación y recolección: {$tiempo_estimado} minutos.
"
                . "Nuestro equipo ya está preparando tus bebidas y alimentos con la máxima frescura.

"
                . "Te enviaremos otro aviso en cuanto tu orden esté 100% lista para ser recolectada en barra.

"
                . "¡Gracias por tu preferencia!";
    } elseif ($tipo === 'pedido_listo') {
        $asunto = "🎉 ¡Tu pedido #$id_venta está LISTO para recolección en Café con Leche!";
        $cuerpo = "¡Buenas noticias, $nombre_cliente!

"
                . "Tu pedido con número de ticket #$id_venta ya terminó todas las etapas de preparación y está listo en mostrador.
"
                . "📍 Puedes pasar a recogerlo en barra presentando tu número de ticket #$id_venta.

"
                . "¡Esperamos que lo disfrutes al máximo!";
    } elseif ($tipo === 'devolucion') {
        $asunto = "🔄 Comprobante de Devolución - Ticket #$id_venta";
        $cuerpo = "Estimado/a $nombre_cliente,

"
                . "Se ha procesado exitosamente la devolución asociada a tu compra #$id_venta.
"
                . "El saldo ha sido reintegrado de conformidad con nuestras políticas de calidad.

"
                . "Café con Leche - Atención al Cliente";
    }

    // Intentar envío real con mail() estándar de PHP si sendmail está configurado
    $headers = "From: pedidos@cafeconleche.com\r\n" .
               "Reply-To: soporte@cafeconleche.com\r\n" .
               "X-Mailer: PHP/" . phpversion();
    
    $mail_enviado = false;
    try {
        if (!empty($email_destinatario) && filter_var($email_destinatario, FILTER_VALIDATE_EMAIL)) {
            // @ suprime advertencias si sendmail local no está encendido en XAMPP
            $mail_enviado = @mail($email_destinatario, $asunto, $cuerpo, $headers);
        }
    } catch (Exception $e) {
        $mail_enviado = false;
    }

    $estado_envio = $mail_enviado ? 'enviado' : 'simulado';

    // Registrar siempre en la tabla notificaciones para auditoría y visualización en la interfaz
    $stmt = $pdo->prepare("
        INSERT INTO notificaciones (id_venta, destinatario, tipo, asunto, cuerpo, estado_envio)
        VALUES (?, ?, ?, ?, ?, ?)
    ");
    $stmt->execute([$id_venta, $email_destinatario, $tipo, $asunto, $cuerpo, $estado_envio]);

    return [
        'destinatario' => $email_destinatario,
        'asunto' => $asunto,
        'tipo' => $tipo,
        'estado_envio' => $estado_envio,
        'cuerpo' => $cuerpo
    ];
}
