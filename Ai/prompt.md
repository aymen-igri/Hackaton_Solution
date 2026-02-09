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














# Prompt numéro 2 – Version améliorée

## Objectif

Créer un **service Grafana** capable de représenter visuellement les données provenant de Prometheus.

---

## Prompt

Je veux que tu **configures et crées un service Grafana** :

* Grafana doit être **conteneurisé** et intégré dans le même **Docker Compose** que Prometheus.
* Grafana doit **se connecter à Prometheus** (qui est déjà présent dans le Docker Compose) comme **source de données principale**.
* Grafana doit pouvoir interroger les API Prometheus suivantes pour visualiser et analyser les données :

```
## 1️⃣ /api/v1/query – valeur instantanée
- Obtenir la valeur actuelle d’une métrique.
Exemples de métriques : http_requests_total, memory_usage_bytes, cpu_usage_seconds_total, disk_io_bytes_total, request_duration_seconds, prometheus_tsdb_head_series, prometheus_engine_queries

## 2️⃣ /api/v1/query_range – série temporelle
- Obtenir l’évolution d’une métrique sur un intervalle de temps.
Exemples : memory_usage_bytes, cpu_usage_seconds_total, http_requests_total, request_duration_seconds_bucket, disk_io_bytes_total

## 3️⃣ /api/v1/alerts – alertes actives
- Obtenir toutes les alertes déclenchées par les alert rules.
Exemples : HighMemoryUsage, HighCPUUsage, ServiceDown, HighErrorRate, DiskFull, LatencyTooHigh

## 4️⃣ /api/v1/series – séries collectées
- Lister toutes les séries collectées par Prometheus.
Exemples : http_requests_total par method et endpoint, memory_usage_bytes par instance, cpu_usage_seconds_total par job et instance, request_duration_seconds_bucket, séries internes Prometheus comme prometheus_tsdb_head_series

## 5️⃣ /api/v1/labels – labels et valeurs
- Lister tous les labels utilisés et leurs valeurs possibles.
Labels : job, instance, method, endpoint, severity, alertname
Exemples de valeurs :
  - job → users_service, payment_service
  - instance → users-1:8080, users-2:8080
  - method → GET, POST
  - endpoint → /api/users, /api/payments
  - severity → warning, critical
  - alertname → HighMemoryUsage, ServiceDown
```
Tester cela a l'aide du docker compose et met les resulat en Ai/TestOuptput.md
Apres l'implmentation  documenter ce que vous a fait  en Ai/output.md
---

## Contraintes

* **Ne rien toucher** à la configuration ou au Docker Compose déjà existants pour Prometheus.
* Grafana doit **s’intégrer sans modifier Prometheus**, uniquement comme service supplémentaire dans Docker Compose.
* Toutes les requêtes et dashboards Grafana doivent utiliser Prometheus comme source de données.
* ne toucher pas ce fichier prompt.md 

---
