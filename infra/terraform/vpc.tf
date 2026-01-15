# vpc.tf
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "5.5.1"

  name = "moduly-vpc" # 서비스 이름 반영
  cidr = "10.0.0.0/16"

  azs             = ["ap-northeast-2a", "ap-northeast-2c"]
  private_subnets = ["10.0.1.0/24", "10.0.2.0/24"]
  public_subnets  = ["10.0.101.0/24", "10.0.102.0/24"]

  enable_nat_gateway   = true
  single_nat_gateway   = true
  enable_dns_hostnames = true

  public_subnet_tags = {
    "kubernetes.io/role/elb"            = 1
    # 클러스터 이름과 일치시켜야 함
    "kubernetes.io/cluster/moduly-cluster" = "shared" 
  }

  private_subnet_tags = {
    "kubernetes.io/role/internal-elb"   = 1
    "kubernetes.io/cluster/moduly-cluster" = "shared"
  }
}