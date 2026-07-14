import { createClient } from '@/lib/supabase/server'
import ProjectsClient from './ProjectsClient'

export default async function ProjectsPage() {
  const supabase = await createClient()
  const [projectsRes, companiesRes] = await Promise.all([
    supabase.from('projects').select('*, companies(name)').order('name'),
    supabase.from('companies').select('*').eq('is_active', true).order('name'),
  ])
  return <ProjectsClient initialProjects={projectsRes.data ?? []} initialCompanies={companiesRes.data ?? []} />
}
