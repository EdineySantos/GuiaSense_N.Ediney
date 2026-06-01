// --- CONFIGURAÇÕES BASEADAS NO SEU JSON ---
const deviceId = 'esp32_01';
const targetUid = '4FFlf2zVmnMCkPIIEvVd2zzlS6K2'; // UID do dono do dispositivo no app Android

let alcanceMaximo = 1.0; // metros
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

// Helpers de Referência (Apontando sempre pro UID correto)
function getConfigRef() {
  const db = getFirebaseDatabase();
  if (!db) return null;
  return db.ref(`configuracoes/${targetUid}`);
}

function getStateRef() {
  const db = getFirebaseDatabase();
  if (!db) return null;
  return db.ref(`estado_dispositivo/${deviceId}`);
}

// Conectar / desconectar simulado UI
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
    saveConfigToFirebase(alcanceMaximo);
  });
});

// Seekbar personalizado (Move)
seekAlc.addEventListener('input', () => {
  const val = parseInt(seekAlc.value, 10);
  alcanceMaximo = val / 100;
  txtAlcAtual.textContent = alcanceMaximo.toFixed(2) + 'm';
  modes.forEach((x) => x.classList.remove('active'));
  updateVibrationInfo();
});

// Ao terminar de ajustar (Solta o clique)
seekAlc.addEventListener('change', () => {
  saveConfigToFirebase(alcanceMaximo);
  showFeedback('✅ Configuração salva!');
});

// Botão Salvar
btnSalvar.addEventListener('click', () => {
  saveConfigToFirebase(alcanceMaximo);
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
  if (window._isLiveData) return;
  const cm = parseInt(simRange.value, 10);
  const m = cm / 100; 
  simulateSensorReading(m);
});

// Inicialização UI
updateVibrationInfo();
simulateSensorReading(parseInt(simRange.value, 10) / 100);
window._isLiveData = false;

// --- LISTENER: Status do Sensor (Leitura em Tempo Real) ---
function listenSensorStatus() {
  const stateRef = getStateRef();
  if (!stateRef) {
    console.warn('Firebase não disponível.');
    return;
  }

  stateRef.on('value', (snap) => {
    const raw = snap.val();
    if (!raw) {
      window._isLiveData = false;
      if (simRange) simRange.disabled = false;
      document.querySelector('.sim-label').textContent = 'Simular distância';
      txtStatus.textContent = 'Desconectado';
      return;
    }

    // Identifica que estamos ao vivo
    window._isLiveData = true;
    if (simRange) simRange.disabled = true;
    document.querySelector('.sim-label').textContent = 'Ao Vivo';

    // Status Conectado
    const isConnected = raw.conectado === true;
    txtStatus.textContent = (isConnected ? 'Conectado' : 'Desconectado') + ' (Ao Vivo)';

    // Distância (Mapeando a chave correta do JSON)
    if (raw.ultima_distancia !== undefined && raw.ultima_distancia !== null) {
      let distanceMeters = Number(raw.ultima_distancia);
      // Se tiver mais que 20, assumimos que o hardware enviou em centímetros
      if (distanceMeters > 20) {
        distanceMeters = distanceMeters / 100.0;
      }
      simulateSensorReading(distanceMeters);
    }

    // Vibração (Mapeando a chave correta do JSON)
    if (raw.vibracao_atual) {
      txtInt.textContent = raw.vibracao_atual;
    }
  });
}

// --- LISTENER: Sincronizar UI se outro dispositivo (ex: App) mudar a configuração ---
function listenUserConfig() {
  const configRef = getConfigRef();
  if (!configRef) return;

  if (configListenerRef) {
    configListenerRef.off();
  }

  configListenerRef = configRef;
  configRef.on('value', (snap) => {
    const cfg = snap.val();
    if (!cfg || cfg.alcance_maximo === undefined) return;

    const novoAlcance = Number(cfg.alcance_maximo);
    if (Number.isNaN(novoAlcance) || novoAlcance <= 0) return;

    // Atualiza a tela automaticamente
    alcanceMaximo = novoAlcance;
    seekAlc.value = Math.round(novoAlcance * 100);
    txtAlcAtual.textContent = novoAlcance.toFixed(2) + 'm';
    updateVibrationInfo();
  });
}

// --- AUTENTICAÇÃO E START ---
function ensureAuthAndStart() {
  const auth = getFirebaseAuth();
  if (!auth) return;

  auth.onAuthStateChanged((user) => {
    if (user) {
      console.log('Site autenticado anonimamente! UID Web:', user.uid);
      // Independentemente do UID web, lemos e escrevemos no UID do app (targetUid)
      listenSensorStatus();
      listenUserConfig();
    } else {
      auth.signInAnonymously().catch((err) => {
        console.error('Falha no login anônimo do Firebase', err);
      });
    }
  });
}

ensureAuthAndStart();

// --- GRAVAR NO FIREBASE ---
function saveConfigToFirebase(alcance) {
  const db = getFirebaseDatabase();
  const auth = getFirebaseAuth();
  
  if (!db || !auth || !auth.currentUser) {
    console.warn('Esperando autenticação para salvar configuração...');
    return;
  }

  const ref = getConfigRef();
  
  // Usamos .UPDATE para não apagar outros nós do usuário no banco
  const payload = {
    alcance_maximo: alcance,
    atualizado_em: firebase.database.ServerValue.TIMESTAMP
  };
  
  ref.update(payload)
    .then(() => console.log('Configuração atualizada no Firebase!'))
    .catch((err) => console.error('Erro ao atualizar no Firebase', err));
}

// --- Wi‑Fi provisioning ---
btnSendWifi.addEventListener('click', () => {
  const ssid = ((wifiSsid && wifiSsid.value) || '').trim();
  const pass = ((wifiPass && wifiPass.value) || '').trim();
  
  if (!ssid || !pass) {
    txtWifiFeedback.textContent = 'Informe SSID e Senha.';
    return;
  }
  
  txtWifiFeedback.textContent = 'Enviando...';
  
  const db = getFirebaseDatabase();
  if (!db) return;

  // A configuração de Wi-fi é gravada num nó vinculado ao ESP32
  const ref = db.ref(`wifi_credentials/${deviceId}`);
  const payload = {
    ssid: ssid,
    password: pass,
    atualizado_em: firebase.database.ServerValue.TIMESTAMP,
  };
  
  ref.update(payload)
    .then(() => {
      console.log('Credenciais Wi‑Fi gravadas');
      txtWifiFeedback.textContent = 'Enviado com sucesso!';
      if (wifiPass) wifiPass.value = '';
    })
    .catch((err) => {
      console.error(err);
      txtWifiFeedback.textContent = 'Erro ao enviar.';
    });
});
