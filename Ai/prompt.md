
---

# Prompt numéro 1 –

## Objectif
Maintenant  creer cicd.yml pour github action


---

## Prompt
Creer moi cicd  de contient les etapes suivant  
Checkout  le code . 
faire le teste unitaire  et linting a l aide du  /sripts/test-and-lint.sh 
faire un build a l aide du docker compose pour tous les service 
deployer  a l aide du docker compose -d up 
Puis verifier le health de chaque sevice  ( endpoint est implementer  deja pour chaque  /health)
exepmle :
        run: |
          SERVICES=("8001" "8002" "8003" "8080")
          for PORT in "${SERVICES[@]}"; do
            echo "Checking service on port $PORT"
            curl -f http://localhost:$PORT/health
          done


  ## contrainte : 
  respeter la regle . 
  ne changer pas le code ou la configuration s il vraiment necessaire  
  



--- 



# Prompt numéro 2  

## objectif  
Generation du sript qui va tester les un check pour les health pour chaque service 


## Prompt
Generer moi le scirpt qui va faire un checke pour le health du 




--- 
