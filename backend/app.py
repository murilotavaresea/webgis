from flask import Flask, request, jsonify
from flask_cors import CORS
import psycopg2
from psycopg2.extras import RealDictCursor
import os
import json

app = Flask(__name__)
CORS(app)

# 🔐 Conexão segura usando variáveis de ambiente
conn = psycopg2.connect(
    host=os.environ.get("DB_HOST"),
    database=os.environ.get("DB_NAME"),
    user=os.environ.get("DB_USER"),
    password=os.environ.get("DB_PASSWORD"),
    cursor_factory=RealDictCursor
)

# 🚀 Testa conexão
cur = conn.cursor()
cur.execute("SELECT current_database();")
print("🔌 Banco conectado:", cur.fetchone()["current_database"])

# 🔄 Lista tabelas com coluna 'geometry'
@app.route("/camadas", methods=["GET"])
def listar_camadas_disponiveis():
    try:
        conn.rollback()  # 🔄 força reset da transação, evita erro "current transaction aborted"
        cur.execute("""
            SELECT table_name
            FROM information_schema.columns
            WHERE column_name = 'geometry'
            AND table_schema = 'public'
        """)
        tabelas = [row["table_name"] for row in cur.fetchall()]
        return jsonify(tabelas)
    except Exception as e:
        return jsonify({"erro": str(e)}), 500


# ✅ Teste de status
@app.route("/")
def home():
    return "🌐 API WebGIS está rodando com sucesso!"

# 👤 Lista usuários (exemplo)
@app.route("/usuarios", methods=["GET"])
def listar_usuarios():
    cur.execute("SELECT * FROM usuarios")
    usuarios = cur.fetchall()
    return jsonify(usuarios)

# 👤 Cria usuário (exemplo)
@app.route("/usuarios", methods=["POST"])
def criar_usuario():
    dados = request.get_json()
    cur.execute("""
        INSERT INTO usuarios (nome, email, senha)
        VALUES (%s, %s, %s)
    """, (dados["nome"], dados["email"], dados["senha"]))
    conn.commit()
    return jsonify({"mensagem": "Usuário criado com sucesso!"})

# 📦 Retorna GeoJSON genérico de qualquer camada
@app.route("/<tabela>", methods=["GET"])
def dados_genericos(tabela):
    try:
        conn.rollback()
        cur.execute(f'SELECT ST_AsGeoJSON(geometry) AS geom FROM "{tabela}"')
        dados = cur.fetchall()

        geojson = []
        for item in dados:
            try:
                geom = json.loads(item["geom"]) if item["geom"] else None
                geojson.append({"geometry": geom})
            except Exception:
                pass  # ignora erro de conversão

        return jsonify(geojson)
    except Exception as e:
        return jsonify({"erro": str(e)}), 500

# 🟢 Rodando localmente (ignorado no Render)
if __name__ == "__main__":
    app.run(host="0.0.0.0", debug=False)
