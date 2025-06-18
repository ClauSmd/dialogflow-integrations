/**
 * TODO(developer):
 * Add your service key to the current folder.
 * Uncomment and fill in these variables.
 */

// Configura las variables necesarias
const projectId = 'vitali-olam';              // Tu ID de proyecto en Google Cloud
const locationId = 'us-central1';             // La región de tu agente, ej: us-central1
const agentId = 'ac888ef4-2da1-49a9-a881-9439303b3dec'; // Tu ID de agente de Dialogflow CX
const languageCode = 'es';                    // El idioma, en este caso 'es' para español
const TELEGRAM_TOKEN = '7943815220:AAGPjBCPFGbMrsI-GsOin8QCvRdI4BBIbT8';  // Token de tu bot de Telegram
const SERVER_URL = 'https://example.com';     // URL pública de tu servidor (reemplázala con la URL real)

// Requiere librerías necesarias
const structProtoToJson = require('../../botlib/proto_to_json.js').structProtoToJson;
const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');

const API_URL = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;
const URI = `/webhook/${TELEGRAM_TOKEN}`;
const WEBHOOK = SERVER_URL + URI;

const app = express();
app.use(bodyParser.json());

// Importa la librería de Google Cloud Dialogflow CX
const { SessionsClient } = require('@google-cloud/dialogflow-cx');
const client = new SessionsClient({ apiEndpoint: `${locationId}-dialogflow.googleapis.com` });

// Convierte la solicitud de Telegram a una solicitud de detectIntent
function telegramToDetectIntent(telegramRequest, sessionPath) {
  const request = {
    session: sessionPath,
    queryInput: {
      text: {
        text: telegramRequest.message.text,
      },
      languageCode,
    }
  };
  return request;
}

// Convierte las respuestas de detectIntent a mensajes de Telegram
async function convertToTelegramMessage(responses, chatId) {
  let replies = [];
  
  for (let response of responses.queryResult.responseMessages) {
    let reply;

    switch (true) {
      case response.hasOwnProperty('text'):
        reply = { chat_id: chatId, text: response.text.text.join() };
        break;
      
      case response.hasOwnProperty('payload'):
        reply = await structProtoToJson(response.payload);
        reply['chat_id'] = chatId;
        break;

      default:
        break;
    }

    if (reply) {
      replies.push(reply);
    }
  }

  return replies;
}

// Función para detectar la intención y obtener la respuesta
async function detectIntentResponse(telegramRequest) {
  const sessionId = telegramRequest.message.chat.id;
  const sessionPath = client.projectLocationAgentSessionPath(projectId, locationId, agentId, sessionId);
  console.info(sessionPath);

  const request = telegramToDetectIntent(telegramRequest, sessionPath);
  const [response] = await client.detectIntent(request);

  return response;
}

// Configura el webhook de Telegram
const setup = async () => {
  const res = await axios.post(`${API_URL}/setWebhook`, { url: WEBHOOK });
  console.log(res.data);
};

// Recibe las solicitudes de Telegram y responde usando Dialogflow
app.post(URI, async (req, res) => {
  const chatId = req.body.message.chat.id;
  const response = await detectIntentResponse(req.body);
  const requests = await convertToTelegramMessage(response, chatId);

  for (let request of requests) {
    try {
      if (request.hasOwnProperty('photo')) {
        await axios.post(`${API_URL}/sendPhoto`, request);
      } else if (request.hasOwnProperty('voice')) {
        await axios.post(`${API_URL}/sendVoice`, request);
      } else {
        await axios.post(`${API_URL}/sendMessage`, request);
      }
    } catch (error) {
      console.log(error);
    }
  }

  return res.send();
});

// Inicia el servidor
const listener = app.listen(process.env.PORT, async () => {
  console.log('Your Dialogflow integration server is listening on port ' + listener.address().port);
  await setup();
});

module.exports = {
  telegramToDetectIntent,
  convertToTelegramMessage
};
