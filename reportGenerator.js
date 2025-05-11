import robotoFont from '../fonts/MyFont-normal.js';
import { jsPDF } from 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js ';

function formatDate(dateString) {
  const date = new Date(dateString);
  return `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.${date.getFullYear()}`;
}

function getStatusText(status) {
  switch (status) {
    case 0: return 'В обработке';
    case 1: return 'Одобрено';
    case 2: return 'Отклонено';
    case 3: return 'Вы отменили';
    default: return 'Неизвестно';
  }
}

window.generateReport = function(application) {
  const doc = new jsPDF();

  // Добавляем шрифт
  doc.addFileToVFS("Roboto-Regular.ttf", robotoFont);
  doc.addFont("Roboto-Regular.ttf", "Roboto", "normal");
  doc.setFont("Roboto");

  // === Заголовок
  doc.setFontSize(16);
  doc.setTextColor(40, 40, 120);
  doc.text("Гостиница «Кристина»", 20, 20);

  doc.setFontSize(12);
  doc.setTextColor(80, 80, 80);
  doc.text("Подтверждение бронирования", 20, 27);

  // === Информация
  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0);
  doc.text(`Фамилия: ${application.surname}`, 20, 40);
  doc.text(`Имя: ${application.name}`, 20, 50);
  doc.text(`Отчество: ${application.patronymic}`, 20, 60);
  doc.text(`Дата рождения: ${formatDate(application.birthday)}`, 20, 70);
  doc.text(`Серия паспорта: ${application.passport_series}`, 20, 80);
  doc.text(`Номер паспорта: ${application.passport_number}`, 20, 90);

  // === Таблица
  doc.autoTable({
    startY: 100,
    head: [['Параметр', 'Данные']],
    body: [
      ['ID заявки', application.id],
      ['Дата заезда', formatDate(application.in)],
      ['Дата выезда', formatDate(application.out)],
      ['Номер комнаты', application.room || 'Не назначен'],
      ['Статус', getStatusText(application.status)]
    ],
    theme: 'grid',
    styles: {
      fontSize: 10,
      cellPadding: 3,
      textColor: [0, 0, 0],
      font: 'Roboto'
    },
    headStyles: {
      font: 'Roboto',
      fontStyle: 'normal',
      fillColor: [70, 130, 180],
      textColor: [255, 255, 255]
    },
    alternateRowStyles: {
      fillColor: [245, 245, 245]
    }
  });

  // === Подпись
  const finalY = doc.lastAutoTable.finalY + 10;
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text("Спасибо, что выбрали нас!", 20, finalY + 10);
  doc.text("Контакты: +7 (XXX) XXX-XX-XX | info@kristina-hotel.ru", 20, finalY + 15);

  // === Сохранить
  doc.save(`Бронь_${application.id}.pdf`);
}