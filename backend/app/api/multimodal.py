# --- START OF FILE app/api/multimodal.py ---
import os
import logging
from flask import Blueprint, request, jsonify, send_file
from werkzeug.utils import secure_filename
from app.utils.db import get_db_connection
from app.utils.redis_client import redis_client  # 导入 Redis
import json

multimodal_bp = Blueprint('multimodal', __name__)
logger = logging.getLogger(__name__)

# 上传文件根目录
UPLOAD_ROOT = os.path.join(os.getcwd(), "uploaded_files")
os.makedirs(UPLOAD_ROOT, exist_ok=True)


# --- 辅助函数：清除列表缓存 ---
def clear_multimodal_list_cache():
    try:
        # 清除所有列表缓存 (multimodal:list:*)
        for key in redis_client.scan_iter("multimodal:list:*"):
            redis_client.delete(key)
        logger.info("[CACHE CLEAR] Multimodal list cache cleared.")
    except Exception as e:
        logger.error(f"[ERROR] Failed to clear multimodal cache: {e}")


# 获取多模态数据列表
@multimodal_bp.route('/api/multimodal', methods=['GET'])
def get_multimodal_list():
    conn = None
    cursor = None
    try:
        modality = request.args.get('modality', '')
        patient_id = request.args.get('patientId', '')

        # --- 1. 查缓存 ---
        cache_key = f"multimodal:list:{modality}:{patient_id}"
        cached_data = redis_client.get(cache_key)
        if cached_data:
            logger.info(f"[CACHE HIT] Multimodal list: {cache_key}")
            return jsonify(json.loads(cached_data))

        # --- 2. 查库 ---
        logger.info(f"[DB QUERY] Fetching multimodal data (Modality: {modality}, Patient: {patient_id})")

        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        sql = """
            SELECT id, patient_id, record_id, source_table, source_pk,
                   modality, text_content, file_path, file_format,
                   description, created_at
            FROM multimodal_data
            WHERE 1=1
        """
        params = []

        if modality:
            sql += " AND modality = %s"
            params.append(modality)
        if patient_id:
            sql += " AND patient_id = %s"
            params.append(patient_id)

        cursor.execute(sql, tuple(params))
        rows = cursor.fetchall()

        data = []
        for row in rows:
            data.append({
                "id": row["id"],
                "patientId": row["patient_id"],
                "recordId": row["record_id"],
                "sourceTable": row["source_table"],
                "sourcePk": row["source_pk"],
                "modality": row["modality"],
                "textContent": row["text_content"],
                "filePath": row["file_path"],     
                "fileFormat": row["file_format"],
                "description": row["description"],
                "createdAt": row["created_at"].isoformat() if row["created_at"] else None,
                # 给前端一个现成可用的文件 URL
                "fileUrl": f"/api/multimodal/file/{row['id']}",
            })

        logger.info(f"[DB RESULT] Fetched {len(data)} records.")

        # --- 3. 写缓存 (30秒) ---
        redis_client.set(cache_key, json.dumps(data), ex=30)

        return jsonify(data)

    except Exception as e:
        logger.error(f"[ERROR] Fetching multimodal list failed: {str(e)}")
        return jsonify({"error": str(e)}), 500

    finally:
        if cursor: cursor.close()
        if conn: conn.close()


# 创建多模态数据（支持 multipart/form-data 上传文件，也支持纯 JSON）
@multimodal_bp.route('/api/multimodal', methods=['POST'])
def create_multimodal():
    conn = None
    cursor = None
    try:
        content_type = request.content_type or ""
        is_multipart = "multipart/form-data" in content_type

        if is_multipart:
            form = request.form
            uploaded_file = request.files.get("file")
            get_field = form.get
        else:
            json_data = request.get_json(silent=True) or {}
            uploaded_file = None
            get_field = json_data.get

        _id = get_field("id")
        modality = get_field("modality")

        logger.info(f"[ACTION] Creating multimodal record: {_id} ({modality})")

        if not _id or not modality:
            return jsonify({"success": False, "message": "id 和 modality 为必填字段"}), 400

        patient_id = get_field("patientId")
        record_id = get_field("recordId")
        source_table = get_field("sourceTable") or "Upload"
        source_pk = get_field("sourcePk") or _id
        text_content = get_field("textContent")
        description = get_field("description")

        file_path = None
        file_format = None

        if uploaded_file and uploaded_file.filename:
            filename = secure_filename(uploaded_file.filename)
            _, ext = os.path.splitext(filename)
            file_format = ext.lstrip(".").lower() if ext else None

            sub_dir = modality if modality in ["text", "image", "audio", "video", "pdf"] else "other"
            save_dir = os.path.join(UPLOAD_ROOT, sub_dir)
            os.makedirs(save_dir, exist_ok=True)

            save_path = os.path.join(save_dir, filename)
            uploaded_file.save(save_path)

            # 存数据库用相对路径，相对于项目根目录
            # 例如：uploaded_files/image/test.jpg
            rel_path = os.path.relpath(save_path, os.getcwd()).replace("\\", "/")
            file_path = rel_path
        else:
            # 若无文件，允许直接传已有路径
            file_path = get_field("filePath")
            file_format = get_field("fileFormat")

        conn = get_db_connection()
        cursor = conn.cursor()

        sql = """
            INSERT INTO multimodal_data
            (id, patient_id, record_id, source_table, source_pk,
             modality, text_content, file_path, file_format, description)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        """
        cursor.execute(
            sql,
            (
                _id,
                patient_id,
                record_id,
                source_table,
                source_pk,
                modality,
                text_content,
                file_path,
                file_format,
                description,
            ),
        )
        conn.commit()

        # 清除列表缓存
        clear_multimodal_list_cache()

        logger.info(f"[SUCCESS] Multimodal record {_id} created.")
        return jsonify(
            {
                "success": True,
                "message": "多模态数据创建成功",
                "data": {
                    "id": _id,
                    "filePath": file_path,
                    "fileFormat": file_format,
                    "fileUrl": f"/api/multimodal/file/{_id}",
                },
            }
        ), 201

    except Exception as e:
        if conn: conn.rollback()
        logger.error(f"[ERROR] Creating multimodal failed: {str(e)}")
        return jsonify({"success": False, "message": str(e)}), 500

    finally:
        if cursor: cursor.close()
        if conn: conn.close()


# 删除多模态数据
@multimodal_bp.route('/api/multimodal/<string:data_id>', methods=['DELETE'])
def delete_multimodal(data_id):
    conn = None
    cursor = None
    try:
        logger.info(f"[ACTION] Deleting multimodal record: {data_id}")

        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # 先查文件路径
        cursor.execute("SELECT file_path FROM multimodal_data WHERE id = %s", (data_id,))
        row = cursor.fetchone()

        if not row:
            logger.warning(f"[BLOCK] Record {data_id} not found.")
            return jsonify({"success": False, "message": "记录不存在"}), 404

        file_path = row["file_path"]

        # 删记录
        cursor.execute("DELETE FROM multimodal_data WHERE id = %s", (data_id,))
        if cursor.rowcount == 0:
            conn.rollback()
            return jsonify({"success": False, "message": "记录不存在或已被删除"}), 404

        conn.commit()

        # 尝试删文件
        if file_path:
            abs_path = file_path if os.path.isabs(file_path) else os.path.join(os.getcwd(), file_path)
            if os.path.exists(abs_path):
                try:
                    os.remove(abs_path)
                    logger.info(f"[FILE DELETE] Removed {abs_path}")
                except Exception as fe:
                    logger.warning(f"[FILE ERROR] Failed to delete file: {fe}")

        # 清除列表缓存
        clear_multimodal_list_cache()

        logger.info(f"[SUCCESS] Record {data_id} deleted.")
        return jsonify({"success": True, "message": "删除成功"}), 200

    except Exception as e:
        if conn: conn.rollback()
        logger.error(f"[ERROR] Deleting multimodal failed: {str(e)}")
        return jsonify({"success": False, "message": str(e)}), 500

    finally:
        if cursor: cursor.close()
        if conn: conn.close()


# 按 id 获取具体文件内容
@multimodal_bp.route('/api/multimodal/file/<string:data_id>', methods=['GET'])
def get_multimodal_file(data_id):
    conn = None
    cursor = None
    try:
        # 文件流不做缓存，直接查库拿路径
        logger.info(f"[FILE ACCESS] Request for record: {data_id}")

        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        cursor.execute("SELECT file_path FROM multimodal_data WHERE id = %s", (data_id,))
        row = cursor.fetchone()

        if not row:
            return jsonify({"success": False, "message": "记录不存在"}), 404

        file_path = row["file_path"]
        if not file_path:
            return jsonify({"success": False, "message": "该记录没有关联文件"}), 404

        # 相对路径 -> 绝对路径
        if os.path.isabs(file_path):
            abs_path = file_path
        else:
            abs_path = os.path.join(os.getcwd(), file_path)
        abs_path = os.path.normpath(abs_path)

        if not os.path.exists(abs_path):
            logger.warning(f"[FILE MISSING] {abs_path}")
            return jsonify({"success": False, "message": "文件不存在"}), 404

        # 直接根据绝对路径返回文件
        return send_file(abs_path, as_attachment=False)

    except Exception as e:
        logger.error(f"[ERROR] File access failed: {str(e)}")
        return jsonify({"success": False, "message": str(e)}), 500

    finally:
        if cursor: cursor.close()
        if conn: conn.close()

# --- END OF FILE app/api/multimodal.py ---
