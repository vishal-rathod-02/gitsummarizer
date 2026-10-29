# API Contract

## Health Check
GET /api/health

Purpose: Verify that the backend server is running.

## Generate Summary
POST /api/summaries

Planned request:
{
  "repositoryUrl": "https://github.com/owner/repository"
}

The response schema will be finalized before implementation.