Voici la **version améliorée du Prompt numéro 1**, **Sidi oussama**, sans changer le fond, uniquement la clarté, la structure et la précision pour un AI 👇

---

# Prompt numéro 1 – Version améliorée

## Objectif

Créer un **mock service Node.js** destiné à **simuler des métriques et des alertes** afin de tester Prometheus.

---

## Prompt

Je veux que tu **crées un service mock en Node.js** dont le rôle est de **simuler et exposer des données métriques** consommables par Prometheus.

Contraintes d’exécution et d’architecture :

* Le service **ne doit pas être inclus dans Docker Compose**.
* Le service doit **s’exécuter localement** sur ma machine.
* Le service doit être **accessible par Prometheus** (communication réseau fonctionnelle).
* Le service doit **exposer des endpoints dédiés** permettant de fournir des métriques simulées.
* Le service est uniquement destiné au **test et à la validation des alert rules Prometheus**.

---

## Données à simuler (alertes cibles)

### 1️⃣ Mémoire et CPU

* HighMemoryUsage → mémoire utilisée > seuil
* MemoryLeakDetected → augmentation continue de la mémoire (5–10 minutes)
* HighCPUUsage → CPU > seuil
* CPUSpikeDetected → pic CPU soudain
* LowCPUIdle → CPU trop sollicité

### 2️⃣ Stockage / disque

* DiskFull → disque > 90%
* DiskAlmostFull → disque > 80%
* DiskReadError → erreurs I/O disque
* DiskWriteError → erreurs d’écriture disque

### 3️⃣ Réseau / trafic

* HighErrorRate → taux d’erreur HTTP > seuil
* HighLatency → latence HTTP > seuil
* ServiceDown → service inaccessible ou timeout
* ConnectionDrops → connexions perdues
* PacketLoss → perte de paquets > seuil

### 4️⃣ Base de données / stockage persistant

* DBConnectionFailed → connexion DB échouée
* DBSlowQuery → requêtes lentes > seuil
* DBHighLockTime → temps de lock élevé
* DBDiskFull → stockage DB presque plein

### 5️⃣ Microservices / application

* PodCrashLoop → crash répétitif de service
* ServiceUnavailable → HTTP 503
* QueueBacklogHigh → file d’attente saturée
* CacheMissRateHigh → taux élevé de cache miss

### 6️⃣ Prometheus (auto-surveillance)

* PrometheusScrapeFailed → scrape échoué
* PrometheusTargetDown → target inactif
* PrometheusTSDBHighSeries → trop de séries collectées
* PrometheusHighMemory → Prometheus consomme trop de RAM
* PrometheusHighCPU → Prometheus sur CPU élevé

---

## Règles importantes

* Ces alertes sont **déclenchées via des alert rules**, elles ne sont **pas automatiques**.
* L’API `/api/v1/alerts` de Prometheus retourne uniquement les alertes :

  * `firing`
  * `pending`

Chaque alerte doit fournir :

* `labels` → job, instance, severity, alertname…
* `annotations` → description et résumé
* `state` → firing / pending
* `activeAt` → timestamp de déclenchement
* `value` → valeur métrique déclenchante

---

## Exposition des données

* Le mock service doit **exposer une API dédiée** permettant à Prometheus de scrapper les métriques.
* Les métriques doivent être **contrôlables/simulables** (seuils dépassés, variations, erreurs, etc.).

---

## Documentation

* Générer une **documentation technique** expliquant :

  * les endpoints exposés
  * les métriques simulées
  * la logique de simulation
* Cette documentation doit être écrite dans le dossier :

```
/Ai/output
/Ai/monitoring/prometheus
/docker-compose.yml

```

---

## Contraintes

* Le mock service **ne doit pas appartenir au réseau Docker** du Docker Compose.
* Le service doit rester **simple**, uniquement dédié aux tests.
* **Ne pas modifier** la configuration ni le Docker Compose de Prometheus,
  **sauf si nécessaire** pour résoudre un problème de connectivité réseau entre Prometheus et le mock service.

---












Voici une **version améliorée, clarifiée et mieux structurée** de ton prompt, **Sidi oussama**, **sans changer le fond ni l’intention**, juste en le rendant plus précis, exploitable et “engineering-ready”.

---

# Prompt n°2 — Service Metrics

## 🎯 Objectif

Créer un **service metrics** chargé de **collecter, agréger et exposer des données de monitoring** afin de les fournir au **UI (React)** via **API REST et WebSocket**.

Ce service joue le rôle d’**intermédiaire entre Prometheus, PostgreSQL et le UI**.

---

## 🧩 Description générale du service

Je veux créer un **service-metrics** qui :

* se connecte à **Prometheus** via ses **API HTTP officielles**
* interroge régulièrement Prometheus (polling)
* expose :

  * des **API REST** pour les données issues de PostgreSQL
  * des **WebSockets** pour pousser les données de monitoring vers le UI
* se connecte à une **base de données PostgreSQL** (lecture uniquement)

---



### 🔹 1. Données Prometheus (polling toutes les 10 secondes)

#### A. Valeurs instantanées

À récupérer via **`/api/v1/query`**

* `prometheus_tsdb_head_series`
  → nombre total de séries dans la TSDB
* `prometheus_engine_queries`
  → nombre de requêtes Prometheus en cours
* `http_requests_total`
  → nombre total de requêtes HTTP

---

#### B. Séries temporelles (historique)

À récupérer via **`/api/v1/query_range`**

* `memory_usage_bytes`
  → évolution de la mémoire sur **1h ou 24h**
* `cpu_usage_seconds_total`
  → évolution de l’utilisation CPU par instance
* `http_requests_total`
  → évolution du nombre de requêtes HTTP sur une période donnée

---

### 🔹 2. Données PostgreSQL (incidents)

À récupérer depuis la base PostgreSQL existante
(le schéma est défini dans `/init-db/01-init-schema.sql`)

* **Total des incidents ouverts par service**
* **Détails des incidents**, incluant :

  * statut
  * service concerné
  * **MTTA**
  * **MTTR**

---

## 🔌 Exposition des données vers le UI

### 🟣 WebSocket Sources de données & collecte

Une connexion WebSocket entre **service-metrics** et le **UI**, avec **deux channels distincts** :

1. **Channel valeurs instantanées**

   * envoie les résultats JSON provenant de `/query`
2. **Channel séries temporelles**

   * envoie les résultats JSON provenant de `/query_range`

👉 Les messages WebSocket doivent transmettre **le JSON brut retourné par Prometheus**, sans transformation métier.

---

### 🔵 API REST (données PostgreSQL)

Endpoints REST à exposer :

* `GET /api/metrics/incidents/by-service`
  → retourne la liste des incidents groupés par service

* `GET /api/metrics/incidents/details`
  → retourne les incidents avec leurs métriques associées (MTTA, MTTR)

---

## ⚙️ Contraintes techniques

* Le service doit :

  * appartenir au **Docker network existant**
  * être déclaré dans **`docker-compose.yml`**
* Le service doit être implémenté en **Node.js**
* Le service est **indépendant**

  * ❌ ne pas modifier
  * ❌ ne pas coupler
  * ❌ ne pas impacter les autres services existants
* le code doit etre simple  
* generer le dockerfile de cette service 

---

## 🧠 Intention architecturale (implicite)

* Prometheus reste la **source de vérité des métriques**
* PostgreSQL reste la **source de vérité des incidents**
* Le service-metrics :

  * agrège
  * expose
  * diffuse
* Le UI ne communique **qu’avec ce service**

---
