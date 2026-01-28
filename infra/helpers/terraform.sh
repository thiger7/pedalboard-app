#!/bin/bash
set -euo pipefail

SCRIPT_DIR=$(dirname "$0")
cd "${SCRIPT_DIR}/../pedalboard"

function usage() {
  cat <<EOF
Usage: [TF_SKIP_INIT=boolean] $0 [-help] <env> <command> [args]
  env          : environment [prod/stg/...]
  command      : terraform command [plan/apply/state/...]
  args         : subcommand [e.g. state "mv"] and terraform command options (see: terraform <command> -help)
EOF
}

### =========================== Main ========================== ###
if [ "$1" = '-h' ] || [ "$1" = '-help' ]; then
  usage
  exit 0
fi

if [ $# -lt 2 ]; then
  echo -e "[ERROR] Invalid parameters\n"
  usage
  exit 128
fi

TF_ENV=$1
TF_COMMAND=$2
TF_ARGS=${*:3}

if [ "${TF_SKIP_INIT-false}" = true ]; then
  echo "[INFO] Skip init..."
else
  if [ "${TF_COMMAND}" = 'init' ]; then
    terraform init \
      -backend-config="./env/${TF_ENV}/s3.tfbackend" \
      -reconfigure \
      ${TF_ARGS}
    exit 0
  else
    terraform init \
      -backend-config="./env/${TF_ENV}/s3.tfbackend" \
      -reconfigure
  fi
fi

case $TF_COMMAND in
  apply | console | destroy | import | plan | refresh)
    # shellcheck disable=SC2086
    terraform "${TF_COMMAND}" -var-file="./env/${TF_ENV}/inputs.tfvars" ${TF_ARGS};;
  *)
    # shellcheck disable=SC2086
    terraform "${TF_COMMAND}" ${TF_ARGS};;
esac
