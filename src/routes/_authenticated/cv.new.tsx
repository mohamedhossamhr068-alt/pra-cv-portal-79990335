import { createFileRoute } from '@tanstack/react-start'
import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export const Route = createFileRoute('/_authenticated/cv/new')({
  component: CreateCVPage,
})

function CreateCVPage() {
  // تعيين "Modern Executive" كقالب افتراضي
  const [selectedTemplate, setSelectedTemplate] = useState<string>("modern_executive")

  return (
    <div className="container mx-auto p-6 max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">إنشاء سيرة ذاتية جديدة</h1>
      
      <div className="space-y-6 bg-white p-6 rounded-lg shadow-sm border">
        
        {/* قسم اختيار القالب - محدد بقالبين فقط بشكل صارم */}
        <div className="space-y-2">
          <label className="text-sm font-medium">اختر قالب السيرة الذاتية</label>
          <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="اختر القالب..." />
            </SelectTrigger>
            <SelectContent>
              {/* الكود الصارم لمنع ظهور الـ 7 قوالب */}
              <SelectItem value="modern_executive">Modern Executive</SelectItem>
              <SelectItem value="corporate_minimal">Corporate Minimal</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* يمكنك إضافة باقي مكونات السيرة الذاتية هنا (الخبرات، التعليم، إلخ) */}
        
        <Button className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white">
          Generate with AI
        </Button>
      </div>
    </div>
  )
}
