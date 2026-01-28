# eks.tf (혹은 main.tf)
module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "~> 21.0"

  # [수정] 아까 정한 서비스 이름 반영 (VPC 태그와 일치해야 함!)
  name    = "moduly-cluster"
  kubernetes_version = "1.31"

  endpoint_public_access = true

  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.private_subnets

  enable_irsa = true

  # 노드 그룹: addon보다 나중에 생성되도록 depends_on 설정
  eks_managed_node_groups = {
    moduly_nodes = {
      min_size     = 1
      max_size     = 4
      desired_size = 2

      instance_types = ["t3.large"]
      capacity_type  = "ON_DEMAND"
      
      disk_size = 50 
      
      tags = {
        Environment = "dev"
        Service     = "moduly"
      }

      metadata_options = {
        http_endpoint               = "enabled"
        http_tokens                 = "required" # IMDSv2 사용
        http_put_response_hop_limit = 2          # 핵심: 1에서 2로 변경
      }
    }
  }

  enable_cluster_creator_admin_permissions = true
}

# EKS Addons - 노드 그룹보다 먼저 생성되어야 함!
resource "aws_eks_addon" "vpc_cni" {
  cluster_name = module.eks.cluster_name
  addon_name   = "vpc-cni"
  addon_version = "v1.20.4-eksbuild.1"  # K8s 1.31 최신 버전
  
  resolve_conflicts_on_create = "OVERWRITE"
  resolve_conflicts_on_update = "PRESERVE"
}

resource "aws_eks_addon" "kube_proxy" {
  cluster_name = module.eks.cluster_name
  addon_name   = "kube-proxy"
  addon_version = "v1.31.13-eksbuild.2"  # K8s 1.31 최신 버전
  
  resolve_conflicts_on_create = "OVERWRITE"
  resolve_conflicts_on_update = "PRESERVE"
}

resource "aws_eks_addon" "coredns" {
  cluster_name = module.eks.cluster_name
  addon_name   = "coredns"
  addon_version = "v1.11.4-eksbuild.24"  # K8s 1.31 최신 버전
  
  resolve_conflicts_on_create = "OVERWRITE"
  resolve_conflicts_on_update = "PRESERVE"
  
  depends_on = [aws_eks_addon.vpc_cni]
}