'use client'
import {useEffect} from 'react'
import {MessageCircleIcon} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {useStudyDesk} from './study-desk'
import type {TutorContext} from '@/app/app/tutor/tutor-workspace'

export function useCourseTutorContext(context:TutorContext) {
  const setContext=useStudyDesk()?.setCourseContext
  const signature=JSON.stringify(context)
  useEffect(()=>{setContext?.(JSON.parse(signature));return()=>setContext?.(null)},[setContext,signature])
}

export function CourseTutorEntry({context}:{context:TutorContext}) {
  const desk=useStudyDesk()
  useCourseTutorContext(context)
  return <Button className="course-tutor-trigger" variant="outline" size="sm" aria-expanded={desk?.companion?.kind==='course-tutor'} onClick={()=>desk?.openCourseTutor()}><MessageCircleIcon/>Ask tutor</Button>
}

export function useTutorSelection(tab:string,selection:TutorContext['selection']) {
  const setSelection=useStudyDesk()?.setTutorSelection
  const signature=JSON.stringify(selection)
  useEffect(()=>{setSelection?.(signature ? {tab,value:JSON.parse(signature)} : null);return()=>setSelection?.(null)},[setSelection,tab,signature])
}
