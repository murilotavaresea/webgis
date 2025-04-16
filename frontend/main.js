const posicaoInicial = [-14.8, -51.5];
const zoomInicial = 5;
const map = L.map('map').setView(posicaoInicial, zoomInicial);
let sortableInstancia = null;


// 🔲 Camada base
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// 📦 Camadas ativas
const camadasAtivas = {};
const cores = ["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd", "#8c564b"];

// 🔁 Carrega lista de camadas da API
fetch("http://127.0.0.1:5000/camadas")
  .then(res => res.json())
  .then(camadas => {
    camadas.forEach((nome, i) => {
      const cor = cores[i % cores.length];
      criarCheckbox(nome, cor);
    });
  });

// ✅ Cria checkbox para cada camada
function criarCheckbox(nome, cor) {
  const painel = document.getElementById("painel-camadas");
  const div = document.createElement("div");
  div.className = "camada-item";
  div.innerHTML = `
    <label>
      <input type="checkbox" onchange="alternarCamada('${nome}', this.checked)">
      <span style="color:${cor}; font-weight: bold;">${nome}</span>
    </label>
  `;
  painel.appendChild(div);
}

// 🌐 Carrega camada e adiciona no mapa
function carregarCamada(nome, cor) {
  fetch(`http://127.0.0.1:5000/${nome}`)
    .then(res => res.json())
    .then(dados => {
      const grupo = L.layerGroup();
      dados.forEach(item => {
        if (item.geometry) {
          const geo = L.geoJSON(item.geometry, {
            style: {
              color: cor,
              weight: 2,
              fillOpacity: 0.3
            },
            onEachFeature: (feature, layer) => {
              layer.bindPopup(`<strong>${nome}</strong>`);
            }
          });
          geo.addTo(grupo);
        }
      });
      camadasAtivas[nome] = grupo;
      grupo.addTo(map);
      adicionarAoGerenciador(nome);
    });
}

// 🔁 Liga/desliga camada
function alternarCamada(nome, visivel) {
  const camada = camadasAtivas[nome];
  if (visivel) {
    if (!camada) {
      const corIndex = Object.keys(camadasAtivas).length;
      const cor = cores[corIndex % cores.length];
      carregarCamada(nome, cor);
    } else {
      camada.addTo(map);
      adicionarAoGerenciador(nome);
    }
  } else {
    if (camada) {
      map.removeLayer(camada);
      removerDoGerenciador(nome);
    }
  }
}

// 🧩 Gerenciador de camadas (drag-and-drop)

function inicializarSortable(force = false) {
  const lista = document.getElementById("layer-list");

  if (!sortableInstancia || force) {
    sortableInstancia = Sortable.create(lista, {
      animation: 150,
      handle: ".handle", // ← muito importante para o arraste funcionar
      onEnd: atualizarOrdemZIndex
    });
  }
}



function adicionarAoGerenciador(nome) {
  const lista = document.getElementById("layer-list");
  if (!lista || document.getElementById(`layer-${nome}`)) return;

  const item = document.createElement("div");
  item.className = "layer-item";
  item.id = `layer-${nome}`;
  item.innerHTML = `
    <span class="handle" style="flex: 1;">${nome}</span>
    <div>
      <button onclick="alternarVisibilidade('${nome}', this)">👁️</button>
      <button onclick="removerCamada('${nome}')">❌</button>
    </div>
  `;
  lista.appendChild(item);

  atualizarOrdemZIndex();
  inicializarSortable(true); // força a reativação
}


function alternarVisibilidade(nome, botao) {
  const camada = camadasAtivas[nome];
  if (!map.hasLayer(camada)) {
    camada.addTo(map);
    botao.textContent = "👁️";
  } else {
    map.removeLayer(camada);
    botao.textContent = "🚫";
  }
}

function removerDoGerenciador(nome) {
  const item = document.getElementById(`layer-${nome}`);
  if (item) item.remove();
}

function removerCamada(nome) {
  const checkbox = [...document.querySelectorAll("#painel-camadas input")]
    .find(c => c.nextElementSibling.textContent.trim() === nome);
  if (checkbox) checkbox.checked = false;
  alternarCamada(nome, false);
}

function atualizarOrdemZIndex() {
  const lista = document.getElementById("layer-list");
  if (!lista) return;
  [...lista.children].reverse().forEach(item => {
    const nome = item.id.replace("layer-", "");
    if (camadasAtivas[nome]) camadasAtivas[nome].bringToFront();
  });
}


// 🎨 Desenhos no mapa
const drawnItems = new L.FeatureGroup();
map.addLayer(drawnItems);

const drawControl = new L.Control.Draw({
  draw: {
    polygon: true,
    polyline: true,
    rectangle: true,
    marker: true,
    circle: false,
    circlemarker: false
  },
  edit: {
    featureGroup: drawnItems,
    remove: true
  }
});
map.addControl(drawControl);

map.on(L.Draw.Event.CREATED, function (e) {
  const layer = e.layer;
  drawnItems.addLayer(layer);
});

// 🎯 Resetar visualização
function resetMapView() {
  map.setView(posicaoInicial, zoomInicial);
}

// ⬇️ Exportar KML
function exportarKML() {
  if (drawnItems.getLayers().length === 0) {
    alert("Desenhe algo no mapa antes de exportar.");
    return;
  }
  const geojson = drawnItems.toGeoJSON();
  const kml = tokml(geojson);
  const blob = new Blob([kml], { type: 'application/vnd.google-earth.kml+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'desenhos.kml';
  a.click();
}

// 📂 Importar KML
document.getElementById("file-input").addEventListener("change", function (event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (e) {
    const parser = new DOMParser();
    const kml = parser.parseFromString(e.target.result, "text/xml");

    const layer = omnivore.kml.parse(kml)
      .on("ready", () => map.fitBounds(layer.getBounds()))
      .on("error", e => {
        alert("Erro ao carregar o arquivo KML.");
        console.error(e);
      });

    layer.addTo(map);
  };
  reader.readAsText(file);
});
