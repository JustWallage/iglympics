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
  read_replication = {
    mode = "disabled"
  }
}

resource "cloudflare_d1_database" "prod" {
  account_id = var.cloudflare_account_id
  name       = "iglympics-prod"
  read_replication = {
    mode = "disabled"
  }
}

# ─── Pages Project ───────────────────────────────────────────────────────────

resource "cloudflare_pages_project" "iglympics" {
  account_id        = var.cloudflare_account_id
  name              = "iglympics"
  production_branch = "main"

  lifecycle {
    ignore_changes = [deployment_configs]
  }
}

# ─── Custom Domain ───────────────────────────────────────────────────────────

resource "cloudflare_pages_domain" "iglympics_domain" {
  account_id   = var.cloudflare_account_id
  project_name = cloudflare_pages_project.iglympics.name
  name         = "iglympics.just.wallage.nl"
}

# ─── Outputs ─────────────────────────────────────────────────────────────────

output "d1_database_id_staging" {
  value = cloudflare_d1_database.staging.id
}

output "d1_database_id_prod" {
  value = cloudflare_d1_database.prod.id
}
