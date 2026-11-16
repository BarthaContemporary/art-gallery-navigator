# ---------------------------------------------------------------------------
# infra/compose/opensearch/Dockerfile — the studio's search engine
# (docs/ops/opensearch-runbook.md; built by ../docker-compose.yml). It lives
# inside infra/compose so that bootstrap.sh ships it with the compose file:
# without it `docker compose up -d` starts NOTHING ("unable to prepare
# context"), not even Postgres.
#
# The official OpenSearch 3.9.0 image with every bundled plugin removed. The
# studio's search uses only what OpenSearch has built in (the analysers,
# highlighting, search-as-you-type), and the bundled plugins cost about
# 150-200 MB of memory on a server it shares with Supabase, start their own
# background jobs and indices (Query Insights keeps the text of every search,
# which can be a person's name or email address, for 7 days), and add APIs
# nobody here uses: machine-learning connectors and notifications that can
# call out to other sites, alerting, SQL, the security plugin that is
# switched off anyway. With the plugin gone, its search.insights.* settings
# do not exist either: setting one in docker-compose.yml stops the node.
#
# Pinned by digest as well as tag, so a re-tagged upstream image cannot slip
# in. Upgrading: change both, and start from an empty volume
# (docs/ops/opensearch-runbook.md, "Upgrading OpenSearch"; infra/README.md §7).
# ---------------------------------------------------------------------------
FROM opensearchproject/opensearch:3.9.0@sha256:3bf4fe26aeb9f7b03c0ebcb1302bb24e855ee6b89fd926d26a71a83ef6f7e076

# Several passes: a plugin that another one extends cannot go first.
# The Performance Analyzer plugin also adds lines to jvm.options at install
# time; they point at its removed config folder, so they go too.
RUN set -eu; cd /usr/share/opensearch; \
    for pass in 1 2 3 4 5 6; do \
      for p in $(bin/opensearch-plugin list); do \
        bin/opensearch-plugin remove --purge "$p" >/dev/null 2>&1 || true; \
      done; \
    done; \
    left="$(bin/opensearch-plugin list)"; \
    if [ -n "$left" ]; then echo "plugins left: $left"; exit 1; fi; \
    sed -i -e '/opensearch-performance-analyzer/d' -e '/^-Dclk\.tck=/d' \
           -e '/^-Djdk\.attach\.allowAttachSelf=/d' -e '/sun\.tools\.attach=ALL-UNNAMED/d' \
           config/jvm.options
