#!/usr/bin/env bash
if [ -z ${GROUP+x} ]; then echo "GROUP is unset"; exit 1; fi
if [ -z ${ACCESS_KEY+x} ]; then echo "ACCESS_KEY is unset"; exit 1; fi
NAME=tidalsocial
PLAN=$NAME-plan

az appservice plan create --sku free --resource-group $GROUP --name $PLAN --is-linux
az webapp create -p $PLAN --resource-group $GROUP --name $NAME -i lionello/$NAME
az webapp config storage-account add --resource-group $GROUP --name $NAME --storage-type AzureFiles --share-name model --account-name $NAME --access-key $ACCESS_KEY --mount-path /model --custom-id model-mount
