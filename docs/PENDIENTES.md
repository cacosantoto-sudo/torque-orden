# Pendientes de Torque & Orden

## Hecho
- Aviso por WhatsApp al cambiar el estado de la orden
- Buscador en Clientes y Órdenes
- Instalar la app en la pantalla de inicio (PWA) + aviso de instalación en celulares
- Firma del cliente al retirar
- Empleados con su propio usuario
- Recordatorios de mantenimiento
- Reportes simples
- Buscar por patente y ficha del vehículo
- Diseño negro industrial y nombre Torque & Orden
- Copia diaria cifrada de la base (GitHub Actions) y "Copia de mis datos" en la app
- Revisión de diseño y usabilidad (tamaños táctiles, etiquetas, textos, zonas seguras del celular)
- Menú inferior (Panel, Clientes, Órdenes, Stock, Más), íconos SVG en lugar de emojis, borrar con "Deshacer", pantallas de carga y estados vacíos
- Presupuesto en formato náutico (repuestos y materiales + mano de obra detallada, observación, materiales a cargo del cliente) en pantalla, WhatsApp y PDF
- Ficha completa del vehículo (marca, modelo, año, color, motor, cilindrada, combustible, código de motor y caja) y buscador de vehículos por marca, modelo, color, patente o cliente
- Historial de mantenimiento (aceite y filtros, caja automática, distribución), próximos services con aviso de vencidos, QR propio de cada vehículo con ficha digital pública (ficha.html) y etiqueta imprimible con logo y próximo service (etiqueta.html)
- Presupuestos con estados (pendiente, aprobado, parcialmente aprobado, rechazado, realizado) y lista con repuestos, mano de obra y total; sector del taller en cada orden; facturado sí/no y PDF de la factura electrónica adjunto a la orden
- Neumáticos (marca, medida, posición, vida útil con aviso de reemplazo, historial de cambios) y alineaciones con sus valores, también en la ficha pública del QR
- Tres cajas (con nombre editable): ingresos y egresos con medio de pago (efectivo, transferencia, cheque, tarjeta), fecha y hora, saldo de cada caja discriminado por medio de pago
- Proveedores: datos, facturas de compra con lectura automática del comprobante (foto o PDF, plan pago), repuestos comprados que suman al stock y actualizan el costo, pagos (con egreso opcional en la caja) y cuenta corriente con facturas vencidas
- Logo del taller sin bordes blancos (PDF, ficha del QR, etiqueta y Configuración); varios celulares del taller e Instagram en el PDF, el WhatsApp del presupuesto y la ficha pública

## Por hacer
- **Backup en una base de datos aparte para los talleres del plan pago** (los usuarios a los que se les venda la app): una copia viva de sus datos en un segundo servidor, además de la copia diaria.
- Copia de seguridad de fotos, firmas y logos (Storage de Supabase).
- Cerrar la activación libre del plan pago (hoy cualquiera puede activarlo desde "Mi Plan").

## Para más adelante
- Facturación electrónica AFIP
- Cobro real del plan pago (Mercado Pago)
