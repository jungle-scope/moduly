provider "kubernetes" {
  host                   = module.eks.cluster_endpoint
  cluster_ca_certificate = base64decode(module.eks.cluster_certificate_authority_data)

  exec {
    api_version = "client.authentication.k8s.io/v1beta1"
    command     = "aws"
    # [주의] 모듈 출력값(output)은 여전히 cluster_name이라는 이름을 써.
    args = ["eks", "get-token", "--cluster-name", module.eks.cluster_name]
  }
}