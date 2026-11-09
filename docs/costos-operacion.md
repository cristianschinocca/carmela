# Costos de operación

Objetivo: intentar mantener la infraestructura de una cafetería por debajo de **USD 10 mensuales en total**, incluyendo backend y base de datos. Es una meta, no un precio garantizado: depende del consumo, las tarifas vigentes, impuestos, dominio, copias y servicios adicionales. La demostración actual no tiene estos servicios desplegados ni consumos medidos.

Precios de referencia consultados el 7 de noviembre de 2026. Revisarlos antes de contratar y durante la operación.

## Servicios previstos

| Servicio | Uso inicial | Referencia de costo |
| --- | --- | --- |
| Railway Hobby | Una API y PostgreSQL con volumen | Mínimo USD 5/mes, con USD 5 de uso incluidos; CPU, memoria, volumen, copias y tráfico pueden elevar el total. |
| Cloudflare Pages | Frontend estático | Solicitudes de archivos estáticos incluidas; las Pages Functions tienen límites y facturación propios. |
| Cloudflare R2 Standard | Imágenes y eventualmente copias | Incluye mensualmente 10 GB-mes y cuotas de operaciones; el excedente se cobra. Requiere activar R2. |
| Resend | Correos transaccionales | Plan gratuito sujeto a límites y disponibilidad; verificar condiciones antes de habilitarlo. |

Fuentes: [Railway: precios](https://docs.railway.com/pricing/plans), [Cloudflare Pages: precios](https://developers.cloudflare.com/pages/functions/pricing/), [Cloudflare R2: precios](https://developers.cloudflare.com/r2/pricing/) y [Resend: precios](https://resend.com/pricing?product=transactional).

## Ejemplo orientativo

Una API y PostgreSQL activos todo el mes, con consumo promedio conjunto de 0,45 GB de memoria y 0,08 vCPU, 2 GB-mes de volumen y 2 GB de tráfico saliente, generarían aproximadamente:

| Concepto | Estimación mensual |
| --- | ---: |
| Memoria: 0,45 GB × USD 10 | USD 4,50 |
| CPU: 0,08 vCPU × USD 20 | USD 1,60 |
| Volumen: 2 GB-mes × USD 0,15 | USD 0,30 |
| Tráfico saliente: 2 GB × USD 0,05 | USD 0,10 |
| **Total estimado de Railway** | **USD 6,50** |

El mínimo de Hobby y sus USD 5 incluidos ya están contemplados: no se suman otros USD 5 a este ejemplo. Si Pages, R2 y Resend permanecen dentro de sus niveles gratuitos, el margen hasta USD 10 sería de USD 3,50 para copias, dominio, impuestos y variaciones. Este cálculo no los incluye ni garantiza que alcancen; las copias de Railway se facturan como almacenamiento. Es imprescindible medir el consumo real, incluidos los procesos de PostgreSQL, y recalcular con los precios y condiciones de la cuenta.

## Controles

- Revisar consumo y proyección de Railway, Cloudflare y Resend; configurar alertas disponibles y límites apropiados antes de desplegar. Un límite estricto puede interrumpir el servicio: decidirlo según la operación del local.
- Evitar entornos permanentes duplicados, réplicas y servicios adicionales sin necesidad. No usar suspensión automática de la API sin evaluar el tiempo de arranque y su efecto en el POS.
- Definir frecuencia, retención y ubicación de copias cifradas, contabilizar su almacenamiento y probar la restauración. El presupuesto no justifica operar sin copias.
- Mantener la base en red privada, controlar el tamaño de imágenes y paginar consultas. Medir antes de ampliar recursos o contratar planes pagos.
- Registrar por separado dominio, impuestos y herramientas externas. La proyección incluye todos los entornos y servicios asociados al negocio, no solo la factura de la API.

Referencias adicionales: [control de costos en Railway](https://docs.railway.com/pricing/cost-control) y [copias de volúmenes](https://docs.railway.com/volumes/backups).
