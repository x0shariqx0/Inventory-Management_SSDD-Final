terraform {
  required_version = ">= 1.0"
}

resource "local_file" "phase5" {
  filename = "phase5_output.txt"
  content  = "Inventory Management SSDD Project - Infrastructure as Code implemented using Terraform."
}