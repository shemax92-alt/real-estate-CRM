const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const method = event.httpMethod;
  const params = event.queryStringParameters || {};
  let body = {};
  try { body = JSON.parse(event.body || '{}'); } catch {}

  try {
    // GET — получить всех клиентов
    if (method === 'GET') {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return { statusCode: 200, headers, body: JSON.stringify(data) };
    }

    // POST — создать клиента
    if (method === 'POST') {
      const client = { ...body, updated_at: new Date().toISOString() };
      const { data, error } = await supabase
        .from('clients')
        .insert([client])
        .select();
      if (error) throw error;
      return { statusCode: 201, headers, body: JSON.stringify(data[0]) };
    }

    // PUT — обновить клиента
    if (method === 'PUT') {
      const { id } = params;
      if (!id) return { statusCode: 400, headers, body: JSON.stringify({ error: 'id required' }) };
      const updates = { ...body, updated_at: new Date().toISOString() };
      const { data, error } = await supabase
        .from('clients')
        .update(updates)
        .eq('id', id)
        .select();
      if (error) throw error;
      return { statusCode: 200, headers, body: JSON.stringify(data[0]) };
    }

    // DELETE — удалить клиента
    if (method === 'DELETE') {
      const { id } = params;
      if (!id) return { statusCode: 400, headers, body: JSON.stringify({ error: 'id required' }) };
      const { error } = await supabase.from('clients').delete().eq('id', id);
      if (error) throw error;
      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    }

    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  } catch (err) {
    console.error(err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
