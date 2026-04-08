terraform {
  required_version = ">= 1.5"

  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket = "iglympics-tfstate"
    key    = "terraform.tfstate"
    region = "auto"

    skip_credentials_validation = true
    skip_metadata_api_check     = true
    skip_region_validation      = true
    skip_requesting_account_id  = true
    skip_s3_checksum            = true
    use_path_style              = true
  }
}

variable "cloudflare_account_id" {
  type      = string
  sensitive = true
}

variable "cloudflare_api_token" {
  type      = string
  sensitive = true
}

provider "cloudflare" {
  api_token = var.cloudflare_api_token
}

# ─── D1 Databases ────────────────────────────────────────────────────────────

resource "cloudflare_d1_database" "staging" {
  account_id = var.cloudflare_account_id
  name       = "iglympics-staging"
}

resource "cloudflare_d1_database" "prod" {
  account_id = var.cloudflare_account_id
  name       = "iglympics-prod"
}

# ─── Custom Domain ───────────────────────────────────────────────────────────
# The Worker is deployed by wrangler; Terraform manages the custom domain.
# Assumes external DNS (e.g. Route53) points iglympics.just.wallage.nl here.

resource "cloudflare_workers_domain" "iglympics" {
  account_id  = var.cloudflare_account_id
  hostname    = "iglympics.just.wallage.nl"
  service     = "iglympics"
  environment = "production"
}

# ─── Outputs ─────────────────────────────────────────────────────────────────

output "d1_database_id_staging" {
  value = cloudflare_d1_database.staging.id
}

output "d1_database_id_prod" {
  value = cloudflare_d1_database.prod.id
}
