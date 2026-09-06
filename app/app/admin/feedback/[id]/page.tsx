import { FeedbackIssue } from '@/components/feedback/feedback-pages'
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;return <FeedbackIssue id={id}/>}
