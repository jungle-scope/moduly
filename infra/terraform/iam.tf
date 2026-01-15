# iam.tf - IAM Roles for EKS Service Accounts

# [추가] 로드밸런서 컨트롤러가 사용할 IAM Role (여권)
module "lb_role" {
  source    = "terraform-aws-modules/iam/aws//modules/iam-role-for-service-accounts-eks"
  version   = "~> 5.47"  # 안정 버전 (v6은 서브모듈 구조 변경됨)
  
  role_name = "moduly_eks_lb_controller" # 역할 이름

  attach_load_balancer_controller_policy = true # 핵심: 정책 자동 연결

  oidc_providers = {
    main = {
      provider_arn               = module.eks.oidc_provider_arn
      namespace_service_accounts = ["kube-system:aws-load-balancer-controller"]
    }
  }
}

# [편의성] Helm 설치할 때 필요한 Role ARN을 출력
output "lb_role_arn" {
  description = "IAM Role ARN for AWS Load Balancer Controller"
  value       = module.lb_role.iam_role_arn
}

# EBS CSI Driver IAM Role
module "ebs_csi_role" {
  source    = "terraform-aws-modules/iam/aws//modules/iam-role-for-service-accounts-eks"
  version   = "~> 5.47"
  
  role_name = "moduly_eks_ebs_csi_driver"

  attach_ebs_csi_policy = true  # EBS CSI 정책 자동 연결

  oidc_providers = {
    main = {
      provider_arn               = module.eks.oidc_provider_arn
      namespace_service_accounts = ["kube-system:ebs-csi-controller-sa"]
    }
  }
}

output "ebs_csi_role_arn" {
  description = "IAM Role ARN for EBS CSI Driver"
  value       = module.ebs_csi_role.iam_role_arn
}
