# Documentation des modifications de Prometheus

## Fichier `prometheus.yml`

Le fichier de configuration principal de Prometheus a été modifié pour répondre aux exigences suivantes :

1.  **Job Unique** : Toutes les cibles de scraping ont été regroupées sous un seul `job_name: 'services'`. Cela simplifie la configuration et la gestion des cibles.
2.  **Cibles (Targets)** : Les services `alert-ingestion:8001` et `incident-management:8002` ont été ajoutés comme cibles statiques pour ce job. Prometheus collectera les métriques à partir de leurs endpoints `/metrics`.
3.  **Fichier de Règles d'Alerte** : La configuration inclut maintenant un fichier de règles externe `alert.rules.yml` via la directive `rule_files`.

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - 'alert.rules.yml'

scrape_configs:
  - job_name: 'services'
    metrics_path: /metrics
    static_configs:
      - targets: ['alert-ingestion:8001', 'incident-management:8002']
```

## Fichier `alert.rules.yml`

Un nouveau fichier a été créé pour héberger les règles d'alerte : `monitoring/prometheus/alert.rules.yml`.

- **Groupe `service-alerts`** : Contient les alertes relatives aux services.
- **Alerte `InstanceDown`** : Une règle d'exemple a été ajoutée. Elle se déclenche si une instance (`up == 0`) est indisponible pendant plus d'une minute.

```yaml
groups:
  - name: service-alerts
    rules:
      - alert: InstanceDown
        expr: up == 0
        for: 1m
        labels:
          severity: "critical"
        annotations:
          summary: "Instance {{ $labels.instance }} down"
          description: "{{ $labels.instance }} of job {{ $labels.job }} has been down for more than 1 minute."
```

## Fichier `docker-compose.yml`

La définition du service `prometheus` a été mise à jour pour monter le nouveau fichier de règles d'alerte dans le conteneur.

- **Volume Ajouté** : Le chemin `./monitoring/prometheus/alert.rules.yml` est mappé à `/etc/prometheus/alert.rules.yml` dans le conteneur `prometheus`.

```yaml
  prometheus:
    image: prom/prometheus:latest
    container_name: prometheus
    restart: unless-stopped
    ports:
      - "9090:9090"
    volumes:
      - ./monitoring/prometheus/prometheus.yml:/etc/prometheus/prometheus.yml
      - ./monitoring/prometheus/alert.rules.yml:/etc/prometheus/alert.rules.yml
      - prometheus_data:/prometheus
```

Ces changements permettent une configuration de monitoring plus propre, centralisée et prête à être étendue avec de nouvelles alertes.
