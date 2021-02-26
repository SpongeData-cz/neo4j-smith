# Neo4j Smith
> OGM for Neo4j

# Table of Contents
* [Neo4j for Testing Purposes](#neo4j-for-testing-purposes)

# Neo4j for Testing Purposes

* Make directories:

```
mkdir plugins data
```

* Download APOC plugin for Neo4j:

```
pushd plugins
wget https://github.com/neo4j-contrib/neo4j-apoc-procedures/releases/download/4.2.0.0/apoc-4.2.0.0-all.jar
popd
```

* Run Neo4j:

```
docker run \
  -v $PWD/data:/data \
  -v $PWD/plugins:/plugins \
  -p7474:7474 \
  -p7687:7687 \
  -e NEO4J_AUTH=neo4j/neo4jneo4j \
  neo4j:4.2
```
