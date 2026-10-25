-- Amplia logs_errores para tambien poder guardar mensajes de EXITO que el
-- frontend le muestra al usuario (ej. "Correo enviado correctamente"), no
-- solo errores capturados por el error-handler -- ver POST /api/logs/registrar.
-- 'info' se agrega de una vez por consistencia con ToastService.TipoToast,
-- aunque hoy solo se registran los de tipo 'exito'.
alter table logs_errores drop constraint if exists logs_errores_nivel_check;
alter table logs_errores add constraint logs_errores_nivel_check
    check (nivel in ('error', 'advertencia', 'exito', 'info'));
