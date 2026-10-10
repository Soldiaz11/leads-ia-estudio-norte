import { workflow, node, trigger, sticky, newCredential, ifElse, languageModel, expr } from '@n8n/workflow-sdk';

const LEADS = { __rl: true, mode: 'id', value: '992bc0f0-0e9f-4627-bf41-f097c7eed8d6', cachedResultName: 'Leads' };
const SERVICIOS = { __rl: true, mode: 'id', value: '6d6b06f3-0090-441b-aa84-cbb6a1bd2a2c', cachedResultName: 'Servicios' };
const ERRORES = { __rl: true, mode: 'id', value: 'f0819e2e-95fa-4678-a80d-4ae799af19c8', cachedResultName: 'Log de Errores' };
const PAGINA_LEAD = { __rl: true, mode: 'id', value: expr("{{ $('Guardar Lead en Notion (Pendiente)').first().json.id }}") };

const gmailTrigger = trigger({ type: 'n8n-nodes-base.gmailTrigger', version: 1.4, config: { name: 'Gmail: Nuevo Email de Cliente', position: [0, 300], parameters: {
  pollTimes: { item: [{ mode: 'everyMinute' }] }, event: 'messageReceived', simple: false, maxResults: 1,
  filters: { q: 'subject:(consulta OR presupuesto OR cotizacion OR reforma) -from:me -subject:APROBACION', readStatus: 'unread' },
  options: { downloadAttachments: false }
}, credentials: { gmailOAuth2: newCredential('Gmail') } }, output: [{ id: '18f1a2b3c4d5e6f7', threadId: '18f1a2b3c4d5e6f7', subject: 'Consulta reforma de cocina', text: 'Hola, quiero reformar la cocina de mi depto en Palermo, 12 m2, presupuesto 8000 USD.', from: { value: [{ address: 'cliente@example.com', name: 'Laura Gómez' }] } }] });

const preparar = node({ type: 'n8n-nodes-base.set', version: 3.4, config: { name: 'Preparar Datos y Configuración', position: [240, 300], parameters: { mode: 'manual', includeOtherFields: false, assignments: { assignments: [
  { id: 'a1', name: 'nombre', value: expr("{{ $json.from.value[0].name || $json.from.value[0].address.split('@')[0] }}"), type: 'string' },
  { id: 'a2', name: 'email', value: expr('{{ $json.from.value[0].address.toLowerCase() }}'), type: 'string' },
  { id: 'a3', name: 'asunto', value: expr('{{ $json.subject }}'), type: 'string' },
  { id: 'a4', name: 'mensaje', value: expr("{{ ($json.text || '').split(/\\n\\s*(El|On) .+(escribió|wrote):/)[0].replace(/[{}]/g, '').trim().slice(0, 2000) }}"), type: 'string' },
  { id: 'a5', name: 'gmailMessageId', value: expr('{{ $json.id }}'), type: 'string' },
  { id: 'a6', name: 'gmailThreadId', value: expr('{{ $json.threadId }}'), type: 'string' },
  { id: 'a7', name: 'empresa', value: 'Estudio Norte Arquitectura', type: 'string' },
  { id: 'a8', name: 'emailNegocio', value: 'solagudiaz@gmail.com', type: 'string' },
  { id: 'a9', name: 'emailAprobador', value: 'solagudiaz@gmail.com', type: 'string' },
  { id: 'a10', name: 'minCaracteres', value: 15, type: 'number' }
] } } }, output: [{ nombre: 'Laura Gómez', email: 'cliente@example.com', asunto: 'Consulta reforma de cocina', mensaje: 'Hola, quiero reformar la cocina', gmailMessageId: '18f1a2b3c4d5e6f7', gmailThreadId: '18f1a2b3c4d5e6f7', empresa: 'Estudio Norte Arquitectura', emailNegocio: 'negocio@example.com', emailAprobador: 'aprobador@example.com', minCaracteres: 15 }] });

const filtro = node({ type: 'n8n-nodes-base.filter', version: 2.2, config: { name: 'Filtro Anti-Bucle', position: [480, 300], parameters: { conditions: { options: { caseSensitive: false, leftValue: '', typeValidation: 'strict' }, combinator: 'and', conditions: [
  { leftValue: expr('{{ $json.email }}'), rightValue: expr('{{ $json.emailNegocio }}'), operator: { type: 'string', operation: 'notEquals' } },
  { leftValue: expr('{{ $json.asunto }}'), rightValue: 'APROBACION', operator: { type: 'string', operation: 'notContains' } },
  { leftValue: expr('{{ $json.mensaje.length }}'), rightValue: expr('{{ $json.minCaracteres }}'), operator: { type: 'number', operation: 'gte' } }
] } } }, output: [{ nombre: 'Laura Gómez', email: 'cliente@example.com' }] });

const guardarLead = node({ type: 'n8n-nodes-base.notion', version: 3, config: { name: 'Guardar Lead en Notion (Pendiente)', position: [720, 300], retryOnFail: true, maxTries: 3, parameters: { authentication: 'oAuth2', resource: 'databasePage', operation: 'create', dataSourceId: LEADS, title: expr('{{ $json.nombre }}'), propertiesUi: { propertyValues: [
  { key: 'Email|email', emailValue: expr('{{ $json.email }}') },
  { key: 'Asunto|rich_text', textContent: expr('{{ $json.asunto }}') },
  { key: 'Mensaje|rich_text', textContent: expr('{{ $json.mensaje }}') },
  { key: 'Estado|select', selectValue: 'Pendiente' },
  { key: 'Gmail Message ID|rich_text', textContent: expr('{{ $json.gmailMessageId }}') },
  { key: 'Gmail Thread ID|rich_text', textContent: expr('{{ $json.gmailThreadId }}') }
] }, simple: true }, credentials: { notionOAuth2Api: newCredential('Notion') } }, output: [{ id: 'lead-page-id', name: 'Laura Gómez', url: 'https://notion.so/lead' }] });

const marcarLeido = node({ type: 'n8n-nodes-base.gmail', version: 2.2, config: { name: 'Marcar Email como Leído', position: [960, 300], parameters: { resource: 'message', operation: 'markAsRead', messageId: expr("{{ $('Preparar Datos y Configuración').first().json.gmailMessageId }}") }, credentials: { gmailOAuth2: newCredential('Gmail') } }, output: [{ id: '18f1a2b3c4d5e6f7' }] });

const leerServicios = node({ type: 'n8n-nodes-base.notion', version: 3, config: { name: 'Leer Servicios de Notion', position: [1200, 300], executeOnce: true, retryOnFail: true, maxTries: 3, parameters: { authentication: 'oAuth2', resource: 'databasePage', operation: 'getAll', dataSourceId: SERVICIOS, returnAll: true, filterType: 'json', filterJson: '{"property":"Activo","checkbox":{"equals":true}}', simple: true }, credentials: { notionOAuth2Api: newCredential('Notion') } }, output: [{ id: 'serv-1', name: 'Cocina y baño a medida', property_precio_desde_usd: 6500, property_plazo_estimado: '4 a 6 semanas' }] });

const modeloClaude = languageModel({ type: '@n8n/n8n-nodes-langchain.lmChatAnthropic', version: 1.6, config: { name: 'Modelo Claude Sonnet 5', position: [1440, 520], parameters: { model: { __rl: true, mode: 'list', value: 'claude-sonnet-5', cachedResultName: 'Claude Sonnet 5' }, options: { maxTokensToSample: 600 } }, credentials: { anthropicApi: newCredential('Anthropic') } } });

const claude = node({ type: '@n8n/n8n-nodes-langchain.chainLlm', version: 1.9, config: { name: 'Claude: Analizar Lead y Redactar Respuesta', position: [1440, 300], executeOnce: true, retryOnFail: true, maxTries: 2, onError: 'continueErrorOutput', parameters: {
  promptType: 'define',
  text: expr("Analizá este email de un posible cliente.\n\nNombre: {{ $('Preparar Datos y Configuración').first().json.nombre }}\nAsunto: {{ $('Preparar Datos y Configuración').first().json.asunto }}\nMensaje: {{ $('Preparar Datos y Configuración').first().json.mensaje }}\n\nServicios disponibles (base de datos de Notion):\n{{ $('Leer Servicios de Notion').all().map(s => '- id: ' + s.json.id + ' | ' + s.json.name + ' | desde USD ' + s.json.property_precio_desde_usd + ' | plazo: ' + s.json.property_plazo_estimado).join('\\n') }}"),
  messages: { messageValues: [{ type: 'SystemMessagePromptTemplate', message: expr("Sos el asistente comercial de {{ $('Preparar Datos y Configuración').first().json.empresa }}, un estudio de arquitectura. Tu tarea: calificar al posible cliente y escribir un borrador de respuesta que una persona va a revisar.\n\nReglas:\n1. Usá solo los servicios, precios y plazos de la lista. No inventes datos.\n2. Si falta información (ubicación, metros, presupuesto, plazos), pedila con amabilidad.\n3. Tono cálido y profesional, español rioplatense, máximo 150 palabras. Firmá como Equipo {{ $('Preparar Datos y Configuración').first().json.empresa }}.\n4. score: número de 0 a 100. Caliente = 80 o más, Tibio = 50 a 79, Frio = menos de 50.\n\nRespondé SOLO con un objeto JSON válido, sin texto extra, con estas claves: score (número), categoria (Caliente, Tibio o Frio), servicio_id (el id exacto de la lista), resumen (una oración para el equipo), respuesta (el texto del email para el cliente).") }] }
}, subnodes: { model: modeloClaude } }, output: [{ text: '{"score": 85, "categoria": "Caliente", "servicio_id": "serv-1", "resumen": "Reforma de cocina", "respuesta": "Hola Laura..."}' }] });

const extraer = node({ type: 'n8n-nodes-base.set', version: 3.4, config: { name: 'Extraer Respuesta de Claude', position: [1680, 300], onError: 'continueErrorOutput', parameters: { mode: 'manual', includeOtherFields: false, assignments: { assignments: [
  { id: 'b1', name: 'ia', value: expr("{{ JSON.parse($json.text.replace(/```json|```/g, '').trim()) }}"), type: 'object' }
] } } }, output: [{ ia: { score: 85, categoria: 'Caliente', servicio_id: 'serv-1', resumen: 'Reforma de cocina', respuesta: 'Hola Laura...' } }] });

const iaValida = ifElse({ version: 2.2, config: { name: '¿Respuesta de IA Válida?', position: [1920, 300], parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, combinator: 'and', conditions: [
  { leftValue: expr('{{ $json.ia.score }}'), rightValue: 0, operator: { type: 'number', operation: 'gte' } },
  { leftValue: expr('{{ $json.ia.score }}'), rightValue: 100, operator: { type: 'number', operation: 'lte' } },
  { leftValue: expr('{{ $json.ia.respuesta }}'), operator: { type: 'string', operation: 'notEmpty', singleValue: true } }
] } } } });

const guardarIA = node({ type: 'n8n-nodes-base.notion', version: 3, config: { name: 'Actualizar Lead: Procesado por IA', position: [2160, 200], retryOnFail: true, maxTries: 3, parameters: { authentication: 'oAuth2', resource: 'databasePage', operation: 'update', pageId: PAGINA_LEAD, propertiesUi: { propertyValues: [
  { key: 'Estado|select', selectValue: 'Procesado por IA' },
  { key: 'Score|number', numberValue: expr('{{ $json.ia.score }}') },
  { key: 'Categoria|select', selectValue: expr('{{ $json.ia.categoria }}') },
  { key: 'Resumen IA|rich_text', textContent: expr('{{ $json.ia.resumen }}') },
  { key: 'Respuesta propuesta|rich_text', textContent: expr('{{ $json.ia.respuesta }}') },
  { key: 'Servicio|relation', relationValue: [expr('{{ $json.ia.servicio_id }}')] }
] } }, credentials: { notionOAuth2Api: newCredential('Notion') } }, output: [{ id: 'lead-page-id' }] });

const pedirAprobacion = node({ type: 'n8n-nodes-base.gmail', version: 2.2, config: { name: 'Pedir Aprobación (Humano en el Loop)', position: [2400, 200], parameters: {
  resource: 'message', operation: 'sendAndWait',
  sendTo: expr("{{ $('Preparar Datos y Configuración').first().json.emailAprobador }}"),
  subject: expr("[APROBACION] Lead {{ $('Extraer Respuesta de Claude').first().json.ia.categoria }} ({{ $('Extraer Respuesta de Claude').first().json.ia.score }}/100) - {{ $('Preparar Datos y Configuración').first().json.nombre }}"),
  message: expr("<h3>Nuevo posible cliente</h3><p><b>De:</b> {{ $('Preparar Datos y Configuración').first().json.nombre }} ({{ $('Preparar Datos y Configuración').first().json.email }})<br><b>Score:</b> {{ $('Extraer Respuesta de Claude').first().json.ia.score }}/100 - {{ $('Extraer Respuesta de Claude').first().json.ia.categoria }}<br><b>Resumen:</b> {{ $('Extraer Respuesta de Claude').first().json.ia.resumen }}</p><p><b>Mensaje original:</b><br><i>{{ $('Preparar Datos y Configuración').first().json.mensaje }}</i></p><hr><p><b>Respuesta que se va a enviar:</b></p><p>{{ $('Extraer Respuesta de Claude').first().json.ia.respuesta.replace(/\\n/g, '<br>') }}</p><p><a href=\"{{ $('Guardar Lead en Notion (Pendiente)').first().json.url }}\">Ver lead en Notion</a></p>"),
  responseType: 'approval',
  approvalOptions: { values: { approvalType: 'double', approveLabel: 'Aprobar y enviar', disapproveLabel: 'Rechazar' } },
  options: { limitWaitTime: { values: { limitType: 'afterTimeInterval', resumeAmount: 24, resumeUnit: 'hours' } }, appendAttribution: false }
}, credentials: { gmailOAuth2: newCredential('Gmail') } }, output: [{ data: { approved: true } }] });

const aprobado = ifElse({ version: 2.2, config: { name: '¿Aprobado por el Humano?', position: [2640, 200], parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, combinator: 'and', conditions: [
  { leftValue: expr('{{ $json.data?.approved === true }}'), operator: { type: 'boolean', operation: 'true', singleValue: true } }
] } } } });

const marcarAprobado = node({ type: 'n8n-nodes-base.notion', version: 3, config: { name: 'Actualizar Lead: Aprobado por Humano', position: [2880, 100], retryOnFail: true, maxTries: 3, parameters: { authentication: 'oAuth2', resource: 'databasePage', operation: 'update', pageId: PAGINA_LEAD, propertiesUi: { propertyValues: [
  { key: 'Estado|select', selectValue: 'Aprobado por Humano' },
  { key: 'Feedback humano|rich_text', textContent: expr("Aprobado el {{ $now.toFormat('dd/MM/yyyy HH:mm') }}") }
] } }, credentials: { notionOAuth2Api: newCredential('Notion') } }, output: [{ id: 'lead-page-id' }] });

const responder = node({ type: 'n8n-nodes-base.gmail', version: 2.2, config: { name: 'Responder al Cliente (Mismo Hilo)', position: [3120, 100], retryOnFail: true, maxTries: 2, onError: 'continueErrorOutput', parameters: { resource: 'message', operation: 'reply',
  messageId: expr("{{ $('Preparar Datos y Configuración').first().json.gmailMessageId }}"),
  emailType: 'html',
  message: expr("{{ $('Extraer Respuesta de Claude').first().json.ia.respuesta.replace(/\\n/g, '<br>') }}"),
  options: { replyToSenderOnly: true, appendAttribution: false }
}, credentials: { gmailOAuth2: newCredential('Gmail') } }, output: [{ id: '19a0f1e2d3c4b5a6', threadId: '18f1a2b3c4d5e6f7' }] });

const marcarEnviado = node({ type: 'n8n-nodes-base.notion', version: 3, config: { name: 'Actualizar Lead: Enviado', position: [3360, 100], retryOnFail: true, maxTries: 3, parameters: { authentication: 'oAuth2', resource: 'databasePage', operation: 'update', pageId: PAGINA_LEAD, propertiesUi: { propertyValues: [
  { key: 'Estado|select', selectValue: 'Enviado' },
  { key: 'Gmail Thread ID|rich_text', textContent: expr('{{ $json.threadId }}') }
] } }, credentials: { notionOAuth2Api: newCredential('Notion') } }, output: [{ id: 'lead-page-id' }] });

const marcarRechazado = node({ type: 'n8n-nodes-base.notion', version: 3, config: { name: 'Actualizar Lead: Rechazado', position: [2880, 320], retryOnFail: true, maxTries: 3, parameters: { authentication: 'oAuth2', resource: 'databasePage', operation: 'update', pageId: PAGINA_LEAD, propertiesUi: { propertyValues: [
  { key: 'Estado|select', selectValue: 'Rechazado' },
  { key: 'Feedback humano|rich_text', textContent: expr("{{ $json.data?.approved === false ? 'Rechazado por el humano' : 'Sin respuesta en 24 hs' }}") }
] } }, credentials: { notionOAuth2Api: newCredential('Notion') } }, output: [{ id: 'lead-page-id' }] });

const registrarError = node({ type: 'n8n-nodes-base.notion', version: 3, config: { name: 'Registrar Error en Notion', position: [2160, 560], parameters: { authentication: 'oAuth2', resource: 'databasePage', operation: 'create', dataSourceId: ERRORES,
  title: expr("Error en {{ $prevNode.name }} - {{ $now.toFormat('dd/MM HH:mm') }}"),
  propertiesUi: { propertyValues: [
    { key: 'Tipo|select', selectValue: expr("{{ $prevNode.name.startsWith('Claude') ? 'Fallo API IA' : ($prevNode.name.startsWith('Responder') ? 'Fallo envio Gmail' : 'Respuesta IA invalida') }}") },
    { key: 'Nodo|rich_text', textContent: expr('{{ $prevNode.name }}') },
    { key: 'Detalle|rich_text', textContent: expr("{{ ($json.error ? JSON.stringify($json.error) : 'La IA devolvió datos incompletos: ' + JSON.stringify($json)).slice(0, 1900) }}") },
    { key: 'Lead|relation', relationValue: [expr("{{ $('Guardar Lead en Notion (Pendiente)').first().json.id }}")] }
  ] } }, credentials: { notionOAuth2Api: newCredential('Notion') } }, output: [{ id: 'log-id' }] });

const leadError = node({ type: 'n8n-nodes-base.notion', version: 3, config: { name: 'Actualizar Lead: Error', position: [2400, 560], parameters: { authentication: 'oAuth2', resource: 'databasePage', operation: 'update', pageId: PAGINA_LEAD, propertiesUi: { propertyValues: [
  { key: 'Estado|select', selectValue: 'Error' }
] } }, credentials: { notionOAuth2Api: newCredential('Notion') } }, output: [{ id: 'lead-page-id' }] });

const nota1 = sticky('## 1. Entrada y filtro\nGmail revisa cada minuto los emails NO leídos con asunto de consulta (y nunca los nuestros). El filtro corta bucles y mensajes vacíos.', { color: 4, position: [-40, 40], width: 720, height: 200 });
const nota2 = sticky('## 2. Memoria + IA\nSe guarda el lead en Notion, se leen los servicios (base de conocimiento) y Claude califica y redacta la respuesta. Max tokens: 600.', { color: 6, position: [700, 40], width: 1180, height: 200 });
const nota3 = sticky('## 3. Aprobación humana y respuesta\nEl flujo se frena hasta que alguien toca Aprobar en su email. Recién ahí se responde al cliente en el mismo hilo de Gmail.', { color: 3, position: [2120, -140], width: 1420, height: 200 });
const nota4 = sticky('## Errores\nSi Claude falla, devuelve algo inválido o no se puede enviar el email: se registra en Notion (Log de Errores) y el lead queda en estado Error.', { color: 2, position: [2120, 720], width: 520, height: 160 });

export default workflow('leads-ia-simple', 'Leads IA - Estudio Norte (versión simple)')
  .add(gmailTrigger).to(preparar).to(filtro).to(guardarLead).to(marcarLeido).to(leerServicios).to(claude)
  .add(claude.onError(registrarError.to(leadError)))
  .add(claude).to(extraer)
  .add(extraer.onError(registrarError))
  .add(extraer).to(iaValida.onTrue(guardarIA.to(pedirAprobacion).to(aprobado.onTrue(marcarAprobado.to(responder)).onFalse(marcarRechazado))).onFalse(registrarError))
  .add(responder).to(marcarEnviado)
  .add(responder.onError(registrarError))
  .add(nota1).add(nota2).add(nota3).add(nota4);
