const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { method, body, query } = req;

  try {
    // GET /api/clients — получить всех
    if (method === 'GET') {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return res.status(200).json(data);
    }

    // POST /api/clients — создать нового
    if (method === 'POST') {
      const client = { ...body, updated_at: new Date().toISOString() };
      const { data, error } = await supabase
        .from('clients')
        .insert([client])
        .select();
      if (error) throw error;
      return res.status(201).json(data[0]);
    }

    // PUT /api/clients?id=xxx — обновить
    if (method === 'PUT') {
      const { id } = query;
      if (!id) return res.status(400).json({ error: 'id required' });
      const updates = { ...body, updated_at: new Date().toISOString() };
      const { data, error } = await supabase
        .from('clients')
        .update(updates)
        .eq('id', id)
        .select();
      if (error) throw error;
      return res.status(200).json(data[0]);
    }

    // DELETE /api/clients?id=xxx — удалить
    if (method === 'DELETE') {
      const { id } = query;
      if (!id) return res.status(400).json({ error: 'id required' });
      const { error } = await supabase
        .from('clients')
        .delete()
        .eq('id', id);
      if (error) throw error;
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
};
