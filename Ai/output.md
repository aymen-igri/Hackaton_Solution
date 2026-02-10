
## 🔄 Flux de Données Validé

# 📚 Documentation API & WebSocket – Service Metrics

## 🎯 Vue d'ensemble

Le **service-metrics** est un agrégateur de données qui :
- **Scrape Prometheus** toutes les 10 secondes (instant + range queries)
- **Interroge PostgreSQL** pour les incidents
- **Expose une API REST** pour les données persistantes
- **Diffuse via WebSocket** les metrics en temps réel

**Base URL:** `http://localhost:8005`
**WebSocket URL:** `ws://localhost:8005`

---

## 📡 REST API Endpoints

### 1️⃣ Health Check

#### Request
```http
GET /health
```

#### Response (200 OK)
```json
{
  "status": "ok",
  "timestamp": "2026-02-09T10:30:00.000Z"
}
```

#### Exemple cURL
```bash
curl http://localhost:8005/health
```

#### Utilisation React
```typescript
async function checkHealth() {
  const response = await fetch('http://localhost:8005/health');
  const data = await response.json();
  console.log(data.status); // "ok"
}
```

---

### 2️⃣ Metrics Prometheus (format texte)

#### Request
```http
GET /metrics
```

#### Response (200 OK)
````plaintext
# HELP cpu_usage_seconds_total Total number of seconds the CPU has been in use.
# TYPE cpu_usage_seconds_total counter
cpu_usage_seconds_total{job="mock-metrics",instance="host.docker.internal:8081"} 0.15
# HELP memory_usage_bytes Current memory usage in bytes.
# TYPE memory_usage_bytes gauge
memory_usage_bytes{job="mock-metrics",instance="host.docker.internal:8081"} 256000000
# HELP disk_usage_percent Disk usage percentage.
# TYPE disk_usage_percent gauge
disk_usage_percent{job="mock-metrics",instance="host.docker.internal:8081"} 75.5
# HELP http_requests_total Total number of HTTP requests received.
# TYPE http_requests_total counter
http_requests_total{job="mock-metrics",instance="host.docker.internal:8081"} 150
# HELP request_duration_seconds Duration of HTTP requests in seconds.
# TYPE request_duration_seconds histogram
request_duration_seconds{job="mock-metrics",instance="host.docker.internal:8081",le="0.1"} 50
request_duration_seconds{job="mock-metrics",instance="host.docker.internal:8081",le="0.2"} 100
request_duration_seconds{job="mock-metrics",instance="host.docker.internal:8081",le="0.5"} 150
request_duration_seconds{job="mock-metrics",instance="host.docker.internal:8081",le="1"} 150
request_duration_seconds{job="mock-metrics",instance="host.docker.internal:8081",le="+Inf"} 150
````

---

## 📊 WebSocket Channels

### 1️⃣ Metrics Updates

**Channel:** `metrics`

#### Message Format
```json
{
  "cpu_usage_seconds_total": 0.15,
  "memory_usage_bytes": 256000000,
  "disk_usage_percent": 75.5,
  "http_requests_total": 150,
  "request_duration_seconds": {
    "0.1": 50,
    "0.2": 100,
    "0.5": 150,
    "1": 150
  }
}
```

#### Exemple d'Intégration React
```typescript
import { useEffect } from 'react';

function MetricsComponent() {
  useEffect(() => {
    const socket = new WebSocket('ws://localhost:8005');

    socket.onmessage = (event) => {
      const metrics = JSON.parse(event.data);
      console.log('Metrics mises à jour:', metrics);
    };

    return () => {
      socket.close();
    };
  }, []);

  return <div>Vérifiez la console pour les mises à jour des métriques.</div>;
}
```

---

## ⚙️ Configuration

### 1️⃣ Variables d'Environnement

| Nom                  | Description                              | Valeur par Défaut |
|----------------------|------------------------------------------|-------------------|
| `PROMETHEUS_URL`    | URL de Prometheus                        | `http://localhost:9090` |
| `ALERTMANAGER_URL`  | URL d'Alertmanager                      | `http://localhost:9093` |
| `SCRAPE_INTERVAL`   | Intervalle de scraping (en secondes)   | `10`              |
| `MOCK_SERVICE_PORT` | Port du Mock Service                    | `8081`            |

### 2️⃣ Exemples de Configuration

#### Docker Compose
```yaml
version: '3.8'
services:
  prometheus:
    image: prom/prometheus:v2.31.1
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
  alertmanager:
    image: prom/alertmanager:v0.21.0
    ports:
      - "9093:9093"
    volumes:
      - ./alertmanager.yml:/etc/alertmanager/alertmanager.yml
  mock-service:
    image: mock-service:latest
    ports:
      - "8081:8081"
```

#### Kubernetes
```yaml
apiVersion: v1
kind: Service
metadata:
  name: prometheus
spec:
  ports:
    - port: 9090
  selector:
    app: prometheus
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: prometheus
spec:
  replicas: 1
  selector:
    matchLabels:
      app: prometheus
  template:
    metadata:
      labels:
        app: prometheus
    spec:
      containers:
        - name: prometheus
          image: prom/prometheus:v2.31.1
          ports:
            - containerPort: 9090
          volumeMounts:
            - name: config
              mountPath: /etc/prometheus
      volumes:
        - name: config
          configMap:
            name: prometheus-config
```

---

## 🚀 Déploiement

### 1️⃣ Prérequis

- Docker et Docker Compose installés
- Accès à un cluster Kubernetes (pour les exemples Kubernetes)
- `kubectl` configuré pour accéder au cluster

### 2️⃣ Instructions

#### Docker Compose
```bash
# Lancer les services
docker-compose up -d

# Vérifier les logs
docker-compose logs -f
```

#### Kubernetes
```bash
# Appliquer les configurations
kubectl apply -f prometheus-deployment.yaml

# Vérifier les pods
kubectl get pods -l app=prometheus
```

---

## 📚 Références

- [Documentation Prometheus](https://prometheus.io/docs/introduction/overview/)
- [Documentation Alertmanager](https://prometheus.io/docs/alerting/latest/alertmanager/)
- [Documentation Docker Compose](https://docs.docker.com/compose/)
- [Documentation Kubernetes](https://kubernetes.io/docs/home/)

---

## 🛠️ Dépannage

### 1️⃣ Problèmes Courants

- **Problème :** Le Mock Service ne démarre pas.
  - **Solution :** Vérifiez les logs du Mock Service pour des erreurs de syntaxe ou des problèmes de dépendances.

- **Problème :** Prometheus ne scrape pas les métriques.
  - **Solution :** Assurez-vous que l'URL de scrape dans `prometheus.yml` est correcte et que le Mock Service est accessible.

- **Problème :** Alertmanager ne reçoit pas les alertes.
  - **Solution :** Vérifiez la configuration d'Alertmanager et assurez-vous qu'il est en écoute sur le bon port.

### 2️⃣ Logs et Monitoring

- **Mock Service Logs :** `services/mock-metrics/mock-service.log`
- **Prometheus Logs :** Via Docker Compose ou dans le pod Kubernetes
- **Alertmanager Logs :** Via Docker Compose ou dans le pod Kubernetes

---

## 📅 Historique des Modifications

| Date       | Version | Description                          |
|------------|---------|--------------------------------------|
| 2026-02-09 | 1.0     | Première version de la documentation |
| 2026-02-10 | 1.1     | Ajout de la section API/WebSocket   |
| 2026-02-11 | 1.2     | Mise à jour des exemples de config   |