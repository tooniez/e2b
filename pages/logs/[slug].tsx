import type { GetServerSideProps } from 'next'
import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs'
import type { ParsedUrlQuery } from 'querystring'

import { prisma } from 'db/prisma'
import { serverCreds } from 'db/credentials'
import { LiteDeploymentLog } from 'utils/agentLogs'
import AgentRunLogContent from 'components/AgentRunLogContent'

interface PathProps extends ParsedUrlQuery {
  slug: string
}

export const getServerSideProps: GetServerSideProps<Props, PathProps> = async (ctx) => {
  const slug = ctx.params?.slug
  if (!slug) {
    return {
      redirect: {
        destination: '/',
        permanent: false,
      }
    }
  }

  const supabase = createServerSupabaseClient(ctx, serverCreds)
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    return {
      redirect: {
        destination: '/sign',
        permanent: false,
      },
    }
  }

  const splittedLogSlug = slug.split('-')
  const projectSlug = splittedLogSlug.slice(0, splittedLogSlug.length - 1).join('-')
  const logNumber = parseInt(splittedLogSlug.length > 1 ? splittedLogSlug[splittedLogSlug.length - 1] : '0')

  const log = await prisma.log_files.findFirst({
    orderBy: {
      created_at: 'asc',
    },
    skip: logNumber,
    where: {
      deployments: {
        projects: {
          slug: {
            equals: projectSlug,
            mode: 'insensitive',
          }
        }
      },
      projects: {
        teams: {
          users_teams: {
            some: {
              user_id: session.user.id,
            },
          },
        },
      },
    },
    include: {
      deployments: {
        include: {
          projects: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  })

  if (!log || !log.deployments) {
    return {
      notFound: true,
    }
  }

  return {
    props: {
      log: {
        ...log,
        content: JSON.parse(log.content),
      } as any,
    }
  }
}

interface Props {
  log: LiteDeploymentLog
}

function ProjectPage({ log }: Props) {
  return (
    <AgentRunLogContent log={log} />
  )
}

export default ProjectPage