// Estado inicial
let alcanceMaximo = 1.0; // metros
const deviceId = 'esp32_01';
let currentUid = null;
let configListenerRef = null;

const btnConectar = document.getElementById('btn_conectar');
const txtStatus = document.getElementById('txt_status_conexao');
const txtDist = document.getElementById('txt_distancia');
const txtInt = document.getElementById('txt_intensidade');
const viewBar = document.getElementById('view_barra_intensidade');
const viewFill = document.getElementById('view_intensidade');
const simRange = document.getElementById('sim_distance');
const modes = document.querySelectorAll('.mode');
const seekAlc = document.getElementById('seekbar_alcance');
const txtAlcAtual = document.getElementById('txt_alcance_atual');
const txtInfo = document.getElementById('txt_info_vibracao');
const btnSalvar = document.getElementById('btn_salvar');
const txtFeedback = document.getElementById('txt_feedback');
const wifiSsid = document.getElementById('wifi_ssid');
const wifiPass = document.getElementById('wifi_pass');
const btnSendWifi = document.getElementById('btn_send_wifi');
const txtWifiFeedback = document.getElementById('txt_wifi_feedback');

function formatMeters(v) {
  return (v / 100).toFixed(2) + 'm';
}

function updateVibrationInfo() {
  let info = '';
  if (alcanceMaximo === 1.0) {
    info = `📏 Modo Perto (1,00m):\n• < 0,60m → Vibração Forte\n• 0,60m - 0,80m → Vibração Média\n• 0,80m - 1,00m → Vibração Leve`;
  } else if (alcanceMaximo === 1.5) {
    info = `📏 Modo Médio (1,50m):\n• < 0,40m → Vibração Forte\n• 0,40m - 0,80m → Vibração Média\n• 0,80m - 1,50m → Vibração Leve`;
  } else {
    const forte = (alcanceMaximo * 0.4).toFixed(2);
    const media = (alcanceMaximo * 0.7).toFixed(2);
    info = `📏 Modo Personalizado (${alcanceMaximo.toFixed(2)}m):\n• < ${forte}m → Vibração Forte\n• ${forte}m - ${media}m → Vibração Média\n• ${media}m - ${alcanceMaximo.toFixed(2)}m → Vibração Leve`;
  }
  txtInfo.textContent = info;
}

function simulateSensorReading(distanceMeters) {
  txtDist.textContent = distanceMeters.toFixed(2) + 'm';
  let intensidade = 'Nenhuma ⚪';
  const d = distanceMeters;

  if (alcanceMaximo === 1.0) {
    if (d < 0.6) intensidade = 'Forte 🔴';
    else if (d < 0.8) intensidade = 'Média 🟠';
    else if (d < 1.0) intensidade = 'Leve 🟡';
  } else if (alcanceMaximo === 1.5) {
    if (d < 0.4) intensidade = 'Forte 🔴';
    else if (d < 0.8) intensidade = 'Média 🟠';
    else if (d < 1.5) intensidade = 'Leve 🟡';
  } else {
    const forte = alcanceMaximo * 0.4;
    const media = alcanceMaximo * 0.7;
    if (d < forte) intensidade = 'Forte 🔴';
    else if (d < media) intensidade = 'Média 🟠';
    else if (d < alcanceMaximo) intensidade = 'Leve 🟡';
  }

  txtInt.textContent = intensidade;

  // Atualiza barra visual (percentual em relação ao alcanceMaximo)
  const percentual = Math.min(d / alcanceMaximo, 1);
  viewFill.style.width = percentual * 100 + '%';
}

function getFirebaseAuth() {
  if (typeof firebase === 'undefined' || !firebase.auth) return null;
  return firebase.auth();
}

function getFirebaseDatabase() {
  if (typeof firebase === 'undefined' || !firebase.database) return null;
  return firebase.database();
}

function getConfigRef(uid) {
  const db = getFirebaseDatabase();
  if (!db || !uid) return null;
  return db.ref(`configuracoes/${uid}`);
}

function getStateRef() {
  const db = getFirebaseDatabase();
  if (!db) return null;
  return db.ref(`estado_dispositivo/${deviceId}`);
}

function getDeviceRef() {
  const db = getFirebaseDatabase();
  if (!db) return null;
  return db.ref(`dispositivos/${deviceId}`);
}

function syncDeviceRegistry(uid, origin) {
  const ref = getDeviceRef();
  if (!ref || !uid) return Promise.resolve();

  return ref.update({
    uid_proprietario: uid,
    atualizado_em: Date.now(),
    origem: origin,
  });
}

function reportFirebaseIssue(message, error) {
  console.error(message, error);
  if (txtFeedback) {
    txtFeedback.textContent = `${message}`;
    txtFeedback.style.opacity = '1';
  }
}

// Conectar / desconectar simulado
let conectado = false;
btnConectar.addEventListener('click', () => {
  conectado = !conectado;
  txtStatus.textContent = conectado ? 'Conectado' : 'Desconectado';
  btnConectar.textContent = conectado ? 'Desconectar' : 'Conectar ao Óculos';
});

// Modos rápidos
modes.forEach((b) => {
  b.addEventListener('click', () => {
    modes.forEach((x) => x.classList.remove('active'));
    b.classList.add('active');
    const v = parseFloat(b.dataset.value);
    alcanceMaximo = v;
    seekAlc.value = Math.round(v * 100);
    txtAlcAtual.textContent = alcanceMaximo.toFixed(2) + 'm';
    updateVibrationInfo();
    showFeedback(`Modo ${v === 1.0 ? 'Perto' : 'Médio'} selecionado`);
    // Salva automaticamente no Firebase quando o modo for alterado
    try {
      saveConfigToFirebase(alcanceMaximo);
    } catch (e) {
      console.warn('saveConfig erro', e);
    }
  });
});

// Seekbar personalizado
seekAlc.addEventListener('input', () => {
  const val = parseInt(seekAlc.value, 10);
  alcanceMaximo = val / 100;
  txtAlcAtual.textContent = alcanceMaximo.toFixed(2) + 'm';
  modes.forEach((x) => x.classList.remove('active'));
  updateVibrationInfo();
});

// Ao terminar de ajustar (evento change), salva no Firebase
seekAlc.addEventListener('change', () => {
  try {
    saveConfigToFirebase(alcanceMaximo);
    showFeedback('✅ Configuração salva no Firebase');
  } catch (e) {
    console.warn('saveConfig erro', e);
  }
});

// Salvar: simula salvar local e enviar notificacao
btnSalvar.addEventListener('click', () => {
  localStorage.setItem('alcance_maximo', alcanceMaximo);
  // Salva também no Firebase (se inicializado)
  try {
    saveConfigToFirebase(alcanceMaximo);
  } catch (e) {
    console.warn('Erro ao tentar salvar no Firebase', e);
  }
  showFeedback(`✅ Configuração salva! Alcance: ${alcanceMaximo.toFixed(2)}m`);
});

function showFeedback(msg) {
  txtFeedback.textContent = msg;
  txtFeedback.style.opacity = '1';
  setTimeout(() => {
    txtFeedback.style.opacity = '0';
  }, 3000);
}

// Simulação por controle deslizante
simRange.addEventListener('input', () => {
  // Se estivermos recebendo dados em tempo real, ignore a simulação
  if (window._isLiveData) return;
  const cm = parseInt(simRange.value, 10);
  const m = cm / 100; // range em centímetros -> metros
  simulateSensorReading(m);
});

// Inicialização
updateVibrationInfo();
simulateSensorReading(parseInt(simRange.value, 10) / 100);

// Indica se os dados do sensor estão vindo do Realtime DB
window._isLiveData = false;

// Se o Firebase estiver disponível, habilita listener do status do sensor
function listenSensorStatus() {
  const stateRef = getStateRef();
  if (!stateRef) {
    console.warn('Firebase não disponível: listener de sensor não iniciado.');
    return;
  }

  const parseAndApply = (raw) => {
    if (!raw) return false;
    // Normalizar nomes de campo
    const distanceRaw = raw.ultima_distancia !== undefined ? raw.ultima_distancia : raw.distance;
    const intensityText = raw.vibracao_atual || raw.intensity || raw.vibracao;
    const intensityNum = raw.vibracao_intensidade || raw.intensity_value || raw.intensityNum;

    // Há dados ao vivo: desabilita simulação
    window._isLiveData = true;
    if (simRange) simRange.disabled = true;
    const simLabel = document.querySelector('.sim-label');
    if (simLabel) simLabel.textContent = 'Ao Vivo';

    const connected = raw.conectado || raw.connected || false;
    txtStatus.textContent =
      (connected ? 'Conectado' : 'Desconectado') + (window._isLiveData ? ' (Ao Vivo)' : '');

    if (distanceRaw !== undefined && distanceRaw !== null) {
      let distanceMeters = Number(distanceRaw);
      if (distanceMeters > 20) distanceMeters = distanceMeters / 100.0;
      try {
        simulateSensorReading(Number(distanceMeters));
      } catch (e) {
        console.error('Erro ao aplicar leitura do sensor', e);
      }
    }

    if (intensityText) txtInt.textContent = intensityText;
    if (intensityNum !== undefined && intensityNum !== null) {
      const num = Number(intensityNum);
      const percentual = Math.min(Math.max(num / 255, 0), 1);
      viewFill.style.width = percentual * 100 + '%';
    }

    return true;
  };

  stateRef.on(
    'value',
    (snap) => {
      const raw = snap.val();
      if (!parseAndApply(raw)) {
        window._isLiveData = false;
        if (simRange) simRange.disabled = false;
        const simLabel = document.querySelector('.sim-label');
        if (simLabel) simLabel.textContent = 'Simular distância';
        txtStatus.textContent = 'Desconectado';
      }
    },
    (err) => {
      console.error(`Erro no listener estado_dispositivo/${deviceId}:`, err);
    },
  );
}

function listenUserConfig(uid) {
  const configRef = getConfigRef(uid);
  if (!configRef) {
    console.warn('Firebase não disponível: listener de config não iniciado.');
    return;
  }

  if (configListenerRef) {
    configListenerRef.off();
  }

  configListenerRef = configRef;
  configRef.on('value', (snap) => {
    const cfg = snap.val();
    if (!cfg || cfg.alcance_maximo === undefined || cfg.alcance_maximo === null) return;

    const novoAlcance = Number(cfg.alcance_maximo);
    if (Number.isNaN(novoAlcance) || novoAlcance <= 0) return;

    alcanceMaximo = novoAlcance;
    seekAlc.value = Math.round(novoAlcance * 100);
    txtAlcAtual.textContent = novoAlcance.toFixed(2) + 'm';
    updateVibrationInfo();
  });
}

// Autenticação anônima (se as regras exigirem auth)
function ensureAuthAndStart() {
  const auth = getFirebaseAuth();
  if (!auth) {
    try {
      listenSensorStatus();
    } catch (e) {
      console.warn('listenSensorStatus error', e);
    }
    return;
  }

  auth.onAuthStateChanged((user) => {
    if (user) {
      currentUid = user.uid;
      console.log('Autenticado como', user.uid);
      try {
        syncDeviceRegistry(user.uid, 'web');
        listenSensorStatus();
        listenUserConfig(user.uid);
      } catch (e) {
        console.warn('listenSensorStatus error', e);
      }
    } else {
      auth
        .signInAnonymously()
        .then((result) => {
          currentUid = result.user && result.user.uid ? result.user.uid : null;
          if (currentUid) {
            listenUserConfig(currentUid);
          }
        })
        .catch((err) => {
          reportFirebaseIssue(
            'Falha no login anônimo do Firebase. Verifique domínios autorizados e regras.',
            err,
          );
          // fallback: tentar iniciar listener sem auth
          try {
            listenSensorStatus();
          } catch (e) {
            console.warn('listenSensorStatus error', e);
          }
        });
    }
  });
}

// Inicia o processo
ensureAuthAndStart();

// --- Firebase helper (grava no Realtime Database) ---
function saveConfigToFirebase(alcance) {
  const auth = getFirebaseAuth();
  const db = getFirebaseDatabase();
  if (!auth || !db) {
    console.warn('Firebase não está disponível no contexto web.');
    return;
  }

  const persistConfig = (uid) => {
    if (!uid) {
      console.warn('UID anônimo indisponível para gravar configuração.');
      return Promise.resolve();
    }

    const ref = db.ref(`configuracoes/${uid}`);
    const payload = {
      alcance_maximo: alcance,
      atualizado_em: Date.now(),
    };
    return ref
      .set(payload)
      .then(() => syncDeviceRegistry(uid, 'web'))
      .then(() => console.log('Configuração gravada no Firebase'))
      .catch((err) => console.error('Erro ao gravar no Firebase', err));
  };

  if (currentUid) {
    return persistConfig(currentUid);
  }

  const user = auth.currentUser;
  if (user && user.uid) {
    currentUid = user.uid;
    return persistConfig(user.uid);
  }

  return auth
    .signInAnonymously()
    .then((result) => {
      currentUid = result.user && result.user.uid ? result.user.uid : null;
      return persistConfig(currentUid);
    })
    .catch((err) => {
      reportFirebaseIssue('Não foi possível autenticar para salvar a configuração.', err);
      throw err;
    });
}

// --- Wi‑Fi provisioning via Firebase ---
btnSendWifi.addEventListener('click', () => {
  const ssid = ((wifiSsid && wifiSsid.value) || '').trim();
  const pass = ((wifiPass && wifiPass.value) || '').trim();
  if (!ssid) {
    txtWifiFeedback.textContent = 'Informe o SSID.';
    return;
  }
  if (!pass) {
    txtWifiFeedback.textContent = 'Informe a senha.';
    return;
  }
  txtWifiFeedback.textContent = 'Enviando...';
  try {
    saveWifiToFirebase(ssid, pass);
  } catch (e) {
    console.error(e);
    txtWifiFeedback.textContent = 'Erro ao enviar.';
  }
});

function saveWifiToFirebase(ssid, password) {
  if (typeof firebase === 'undefined' || !firebase.database) {
    console.warn('Firebase não disponível.');
    txtWifiFeedback.textContent = 'Firebase não disponível.';
    return;
  }
  // Atenção: este exemplo envia a senha em texto claro ao Realtime DB.
  // Em produção, use autenticação e/ou criptografia no cliente ou no dispositivo receptor.
  const ref = firebase.database().ref(`wifi_credentials/${deviceId}`);
  const payload = {
    ssid: ssid,
    password: password,
    atualizado_em: Date.now(),
  };
  ref
    .set(payload)
    .then(() => {
      console.log('Credenciais Wi‑Fi gravadas no Firebase');
      txtWifiFeedback.textContent = 'Credenciais enviadas com sucesso.';
      // limpa campos
      if (wifiPass) wifiPass.value = '';
    })
    .catch((err) => {
      console.error(err);
      txtWifiFeedback.textContent = 'Erro ao gravar credenciais.';
    });
}
