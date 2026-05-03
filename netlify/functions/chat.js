// netlify/functions/chat.js
// Handles both chatbot AND AI writing assistant calls

exports.handler = async (event) => {

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' }
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) }
  }

  const key = process.env.GROQ_API_KEY
  if (!key) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'GROQ_API_KEY not set in Netlify environment variables.' })
    }
  }

  try {
    const body      = JSON.parse(event.body)
    const { messages, max_tokens, temperature, mode } = body
    const tokens    = max_tokens || (mode === 'assist' ? 1200 : 600)
    const temp      = temperature !== undefined ? temperature : (mode === 'assist' ? 0.8 : 0.6)

    const response = await fetch(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          max_tokens: tokens,
          temperature: temp,
          messages: messages
        })
      }
    )

    const data = await response.json()

    if (!response.ok) {
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({ error: data?.error?.message || `Groq error ${response.status}` })
      }
    }

    return { statusCode: 200, headers, body: JSON.stringify(data) }

  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message })
    }
  }
}
