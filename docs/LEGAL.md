# Legales de Torque & Orden

Guía de lo que hace falta para vender la app en Argentina. Los textos de la app son un punto de partida razonable, **no reemplazan la revisión de un abogado**.

## Ya está en la app
- `terminos.html`: Términos y Condiciones.
- `privacidad.html`: Política de privacidad (Ley 25.326), con la leyenda obligatoria de la Agencia de Acceso a la Información Pública.
- Casilla "acepto" al crear cuenta; la fecha y versión aceptada quedan guardadas en el usuario de Supabase (`user_metadata.acepto_terminos` y `version_terminos`).
- Enlaces a los dos textos en Configuración.
- `LICENSE`: código con todos los derechos reservados (no es código abierto).

## Falta completar
- Datos del titular en `js/legal.js` y en `LICENSE`: nombre o razón social, CUIT, domicilio, correo de contacto y jurisdicción.
- Si se cambian los textos, actualizar la fecha `version` en `js/legal.js` y `VERSION_LEGAL` en `index.html`.

## Trámites recomendados (fuera de la app)
1. **Repositorio privado en GitHub.** Hoy el código es público: cualquiera puede verlo y copiarlo. Vercel sigue publicando igual con el repo privado.
2. **Vercel plan Pro antes de cobrar.** El plan Hobby (gratis) es solo para uso personal y no comercial.
3. **ARCA (ex AFIP):** inscribirse en el Monotributo (o el régimen que corresponda) por la actividad de servicios informáticos y emitir factura por cada cobro.
4. **Registro de base de datos** ante la Agencia de Acceso a la Información Pública (Registro Nacional de Bases de Datos), por la base de usuarios. Es un trámite en línea por Trámites a Distancia.
5. **Marca "Torque & Orden"** en el INPI: buscar antes que no esté registrada y pedirla en las clases 9 (software) y 42 (servicios de software en la nube).
6. **Registro del software** en la Dirección Nacional del Derecho de Autor (opcional): la ley ya protege el código sin registrarlo, pero el depósito sirve como prueba de autoría y fecha.
7. **Al cobrar a consumidores:** botón de baja y botón de arrepentimiento visibles en la app (Ley 24.240 y resoluciones de la Secretaría de Comercio).
8. **Revisión de un abogado** de los textos antes de abrir la venta a otros talleres.
