{{/*
Expand the name of the chart.
*/}}
{{- define "moduly.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this (by the DNS naming spec).
If release name contains chart name it will be used as a full name.
*/}}
{{- define "moduly.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "moduly.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "moduly.labels" -}}
helm.sh/chart: {{ include "moduly.chart" . }}
{{ include "moduly.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "moduly.selectorLabels" -}}
app.kubernetes.io/name: {{ include "moduly.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Component-specific labels
Usage: {{ include "moduly.componentLabels" (dict "component" "gateway" "context" .) }}
*/}}
{{- define "moduly.componentLabels" -}}
{{ include "moduly.labels" .context }}
app.kubernetes.io/component: {{ .component }}
{{- end }}

{{/*
Component-specific selector labels
Usage: {{ include "moduly.componentSelectorLabels" (dict "component" "gateway" "context" .) }}
*/}}
{{- define "moduly.componentSelectorLabels" -}}
{{ include "moduly.selectorLabels" .context }}
app.kubernetes.io/component: {{ .component }}
{{- end }}

{{/*
Create the name of the service account to use
*/}}
{{- define "moduly.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "moduly.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
Get PostgreSQL host
*/}}
{{- define "moduly.postgresql.host" -}}
{{- if .Values.postgresql.enabled }}
{{- printf "%s-postgresql" (include "moduly.fullname" .) }}
{{- else }}
{{- required "External PostgreSQL host must be specified when postgresql.enabled is false" .Values.postgresql.externalHost }}
{{- end }}
{{- end }}

{{/*
Get Redis host
*/}}
{{- define "moduly.redis.host" -}}
{{- if .Values.redis.enabled }}
{{- printf "%s-redis-master" (include "moduly.fullname" .) }}
{{- else }}
{{- required "External Redis host must be specified when redis.enabled is false" .Values.redis.externalHost }}
{{- end }}
{{- end }}

{{/*
Get the ConfigMap name
*/}}
{{- define "moduly.configMapName" -}}
{{- printf "%s-config" (include "moduly.fullname" .) }}
{{- end }}

{{/*
Get the Secret name
*/}}
{{- define "moduly.secretName" -}}
{{- printf "%s-secrets" (include "moduly.fullname" .) }}
{{- end }}

{{/*
Return the appropriate apiVersion for ingress
*/}}
{{- define "moduly.ingress.apiVersion" -}}
{{- if semverCompare ">=1.19-0" .Capabilities.KubeVersion.GitVersion }}
{{- print "networking.k8s.io/v1" }}
{{- else if semverCompare ">=1.14-0" .Capabilities.KubeVersion.GitVersion }}
{{- print "networking.k8s.io/v1beta1" }}
{{- else }}
{{- print "extensions/v1beta1" }}
{{- end }}
{{- end }}

{{/*
Return the appropriate apiVersion for NetworkPolicy
*/}}
{{- define "moduly.networkPolicy.apiVersion" -}}
{{- if semverCompare ">=1.7-0" .Capabilities.KubeVersion.GitVersion }}
{{- print "networking.k8s.io/v1" }}
{{- else }}
{{- print "extensions/v1beta1" }}
{{- end }}
{{- end }}
