import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDgnlTemplateDto } from './dto/dgnl-template.dto';

const TEMPLATE_INCLUDE = { sections: { orderBy: { order: 'asc' as const } } };

// Mẫu đề ĐGNL dùng chung — admin khai báo 1 lần (section theo môn + số câu +
// thang điểm, tổng 150), tái dùng nhiều lần khi AI ghép đề thay vì phải gõ
// lại section thủ công mỗi lần (xem ExamsService.generateDgnlExam).
@Injectable()
export class DgnlTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.dgnlTemplate.findMany({
      include: TEMPLATE_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const template = await this.prisma.dgnlTemplate.findUnique({
      where: { id },
      include: TEMPLATE_INCLUDE,
    });
    if (!template) {
      throw new NotFoundException('Không tìm thấy mẫu đề ĐGNL');
    }
    return template;
  }

  create(dto: CreateDgnlTemplateDto) {
    const totalScore = dto.sections.reduce((sum, s) => sum + s.maxScore, 0);
    if (Math.abs(totalScore - 150) > 0.01) {
      throw new BadRequestException(
        `Tổng thang điểm mẫu ĐGNL phải bằng 150 (hiện tại: ${totalScore})`,
      );
    }
    return this.prisma.dgnlTemplate.create({
      data: {
        name: dto.name,
        sections: {
          create: dto.sections.map((s, i) => ({
            name: s.name,
            subjectId: s.subjectId,
            questionCount: s.questionCount,
            maxScore: s.maxScore,
            order: i + 1,
          })),
        },
      },
      include: TEMPLATE_INCLUDE,
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.dgnlTemplate.delete({ where: { id } });
  }
}
