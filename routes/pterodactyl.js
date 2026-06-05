const axios = require('axios');
const { User, getConfig } = require('../models');

async function getUserIdByUsername(apiUrl, apiKey, username) {
  try {
    const res = await axios.get(`${apiUrl}/api/application/users?filter[username]=${username}`, {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json', 'Content-Type': 'application/json' },
      timeout: 10000
    });
    if (res.data && res.data.data && res.data.data.length > 0) {
      return res.data.data[0].attributes.id;
    }
    return null;
  } catch (e) { return null; }
}

async function deployServer(order) {
  try {
    const config = await getConfig();
    if (!config || !config.pterodactyl || !config.pterodactyl.applicationApiUrl || !config.pterodactyl.applicationApiKey) {
      return { success: false, error: 'Pterodactyl tidak dikonfigurasi.' };
    }

    const ptero = config.pterodactyl;
    const apiUrl = ptero.applicationApiUrl.replace(/\/$/, '');
    const apiKey = ptero.applicationApiKey;

    const user = await User.findOne({ id: order.userId }).lean();
    const pteroUsername = order.pterodactylUsername || (user ? user.username : 'user');

    let pteroUserId = await getUserIdByUsername(apiUrl, apiKey, pteroUsername);

    if (!pteroUserId && user) {
      try {
        const createUserRes = await axios.post(`${apiUrl}/api/application/users`, {
          email: user.email,
          username: pteroUsername,
          first_name: user.username,
          last_name: 'Hosting',
          password: Math.random().toString(36).slice(-10) + 'Zh@1'
        }, {
          headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json', 'Content-Type': 'application/json' },
          timeout: 10000
        });
        pteroUserId = createUserRes.data.attributes.id;
      } catch (e) {
        return { success: false, error: 'Gagal membuat user Pterodactyl: ' + (e.message || '') };
      }
    }

    if (!pteroUserId) return { success: false, error: 'User Pterodactyl tidak ditemukan.' };

    const ram = parseInt(order.resources.ram) || 1024;
    const cpu = parseInt(order.resources.cpu) || 100;
    const disk = parseInt(order.resources.disk) || 5120;
    const databases = parseInt(order.resources.databases) || 1;
    const backups = parseInt(order.resources.backups) || 1;

    const body = {
      name: `${pteroUsername}-${Date.now()}`,
      user: pteroUserId,
      egg: parseInt(ptero.eggId) || 15,
      docker_image: 'ghcr.io/pterodactyl/yolks:java_17',
      startup: 'java -Xms128M -Xmx{{SERVER_MEMORY}}M -jar {{SERVER_JARFILE}}',
      environment: { SERVER_JARFILE: 'server.jar', VANILLA_VERSION: 'latest' },
      limits: { memory: ram, swap: 0, disk, io: 500, cpu },
      feature_limits: { databases, backups },
      allocation: { default: parseInt(ptero.allocationId) || 1 }
    };

    const res = await axios.post(`${apiUrl}/api/application/servers`, body, {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json', 'Content-Type': 'application/json' },
      timeout: 15000
    });

    if (res.data && res.data.attributes) {
      return { success: true, serverId: res.data.attributes.id.toString(), serverUuid: res.data.attributes.uuid };
    }
    return { success: false, error: 'Respons tidak valid dari Pterodactyl.' };
  } catch (err) {
    const errMsg = err.response ? JSON.stringify(err.response.data) : err.message;
    return { success: false, error: errMsg };
  }
}

async function testConnection(config) {
  try {
    const ptero = config.pterodactyl;
    if (!ptero || !ptero.applicationApiUrl || !ptero.applicationApiKey) {
      return { success: false, error: 'API URL dan Key belum diisi.' };
    }
    const apiUrl = ptero.applicationApiUrl.replace(/\/$/, '');
    const res = await axios.get(`${apiUrl}/api/application/nodes`, {
      headers: { Authorization: `Bearer ${ptero.applicationApiKey}`, Accept: 'application/json' },
      timeout: 8000
    });
    return { success: true, message: `Terhubung! Ditemukan ${res.data.meta ? res.data.meta.pagination.total : 0} node.` };
  } catch (err) {
    return { success: false, error: err.response ? `HTTP ${err.response.status}: ${JSON.stringify(err.response.data)}` : err.message };
  }
}

module.exports = { deployServer, testConnection };
