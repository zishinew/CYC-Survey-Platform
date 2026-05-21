import re

def patch_file(file_path):
    with open(file_path, "r") as f:
        content = f.read()

    # 1. Fix the top buttons container and the question text wrapper
    # From:
    # <div className="flex items-center space-x-4 mb-4 pr-8">
    #   <span className="font-bold text-gray-400">{q.type === 'section_header' ? '§' : `Q${qIdx + 1}`}</span>
    #   <div className="flex-grow">
    #     <RichTextEditor
    
    old_q_wrap = """<div className="flex items-center space-x-4 mb-4 pr-8">
                <span className="font-bold text-gray-400">{q.type === 'section_header' ? '§' : `Q${qIdx + 1}`}</span>
                <div className="flex-grow">"""
    
    new_q_wrap = """<div className="flex items-start space-x-4 mb-4 pr-28">
                <span className="font-bold text-gray-400 mt-8 w-6 text-right">{q.type === 'section_header' ? '§' : `Q${qIdx + 1}`}</span>
                <div className="flex-grow">
                  <label className="block text-sm font-medium text-gray-600 capitalize mb-1">{q.type.replace('_', ' ')}</label>"""
    
    content = content.replace(old_q_wrap, new_q_wrap)

    # 2. Remove the old badge: <span className="bg-gray-100 px-2 py-1 rounded capitalize">{q.type.replace('_', ' ')}</span>
    old_badge = """<span className="bg-gray-100 px-2 py-1 rounded capitalize">{q.type.replace('_', ' ')}</span>"""
    content = content.replace(old_badge, "")

    # 3. Fix the ml-8 and ml-10 alignments
    # The options/section descriptions are inside:
    # <div className="space-y-3 ml-8"> -> make it ml-10 pr-28 for section description
    # <div className="ml-8 space-y-2"> -> make it ml-10 pr-28 for options
    # <div className="mt-4 pt-4 border-t ml-8"> -> make it ml-10 pr-28 for interactive definitions

    content = content.replace('<div className="space-y-3 ml-8">', '<div className="space-y-3 ml-10 pr-28">')
    content = content.replace('<div className="ml-8 space-y-2">', '<div className="ml-10 pr-28 space-y-2">')
    content = content.replace('<div className="mt-4 pt-4 border-t ml-8">', '<div className="mt-4 pt-4 border-t ml-10 pr-28">')
    
    # 4. Also fix the alignment of the required/conditional checkboxes
    # <div className="flex items-center flex-wrap gap-3 mb-4 text-sm text-gray-600">
    # make it ml-10
    old_checkboxes = """<div className="flex items-center flex-wrap gap-3 mb-4 text-sm text-gray-600">"""
    new_checkboxes = """<div className="flex items-center flex-wrap gap-3 mb-4 text-sm text-gray-600 ml-10">"""
    content = content.replace(old_checkboxes, new_checkboxes)

    with open(file_path, "w") as f:
        f.write(content)
    print(f"Patched {file_path}")

patch_file("src/app/admin/create/page.tsx")
patch_file("src/app/admin/edit/[id]/page.tsx")
