FROM prom/prometheus:main

WORKDIR /usr/src/app
COPY prometheus.yml /etc/prometheus/
COPY prometheus.rules.yml /usr/src/app/prometheus.rules.yml
CMD [   "--config.file=/etc/prometheus/prometheus.yml", \
        "--storage.tsdb.path=/prometheus", \
        "--web.console.libraries=/usr/share/prometheus/console_libraries",\
        "--web.console.templates=/usr/share/prometheus/consoles", \
        "--enable-feature=exemplar-storage" \
    ]
