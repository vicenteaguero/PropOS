#!/bin/bash

SCOPE=$1
EMOJI=$2
MSG=$3
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
echo "[$TIMESTAMP] [$SCOPE] $EMOJI $MSG"
